from collections.abc import Iterator
from datetime import datetime
import io
import json
from pathlib import Path
import queue
import threading
import zipfile
from urllib.parse import quote

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..config import BLOB_DIR
from ..deps import (
    get_current_user,
    get_db,
    get_effective_project_role,
    get_project_or_404,
    require_project_role,
)
from ..models import Comment, CommentMention, Notification
from ..models import File as FileModel
from ..models import FileVersion, Project, ProjectMember, User
from ..notification_events import create_project_download_notifications
from ..schemas import (
    MemberAdd,
    MemberOut,
    MemberUpdate,
    ProjectCreate,
    ProjectOut,
)
from ..storage import get_blob_path


router = APIRouter(prefix="/api/projects", tags=["projects"])


class _QueueWriter:
    def __init__(self, chunks: queue.Queue[bytes | BaseException | None]) -> None:
        self.chunks = chunks

    def write(self, data: bytes) -> int:
        if data:
            self.chunks.put(bytes(data))
        return len(data)

    def flush(self) -> None:
        pass


def _stream_zip(entries: list[tuple[str, Path]]) -> Iterator[bytes]:
    chunks: queue.Queue[bytes | BaseException | None] = queue.Queue(maxsize=32)

    def produce() -> None:
        try:
            with zipfile.ZipFile(_QueueWriter(chunks), "w", zipfile.ZIP_STORED) as zf:
                for arcname, blob_path in entries:
                    zf.write(blob_path, arcname=arcname)
        except BaseException as exc:
            chunks.put(exc)
        finally:
            chunks.put(None)

    thread = threading.Thread(target=produce, daemon=True)
    thread.start()

    while True:
        chunk = chunks.get()
        if chunk is None:
            break
        if isinstance(chunk, BaseException):
            raise chunk
        yield chunk


def _safe_zip_name(name: str) -> str:
    cleaned = name.strip().replace("\\", "_").replace("/", "_")
    return cleaned or "未命名项目"


def _dt(value: datetime) -> str:
    return value.isoformat()


def _parse_dt(value: str) -> datetime:
    return datetime.fromisoformat(value)


def _full_backup_payload(db: Session) -> dict:
    return {
        "format": "zgg-full-backup-v1",
        "created_at": datetime.utcnow().isoformat(),
        "users": [
            {
                "id": row.id,
                "username": row.username,
                "email": row.email,
                "password_hash": row.password_hash,
                "is_admin": row.is_admin,
                "ui_language": row.ui_language,
                "ui_theme": row.ui_theme,
                "edrawings_exe_path": row.edrawings_exe_path,
                "created_at": _dt(row.created_at),
            }
            for row in db.query(User).order_by(User.id.asc()).all()
        ],
        "projects": [
            {
                "id": row.id,
                "name": row.name,
                "description": row.description,
                "owner_id": row.owner_id,
                "created_at": _dt(row.created_at),
            }
            for row in db.query(Project).order_by(Project.id.asc()).all()
        ],
        "project_members": [
            {"project_id": row.project_id, "user_id": row.user_id, "role": row.role}
            for row in db.query(ProjectMember)
            .order_by(ProjectMember.project_id.asc(), ProjectMember.user_id.asc())
            .all()
        ],
        "files": [
            {
                "id": row.id,
                "project_id": row.project_id,
                "name": row.name,
                "current_version_id": row.current_version_id,
                "created_at": _dt(row.created_at),
            }
            for row in db.query(FileModel).order_by(FileModel.id.asc()).all()
        ],
        "file_versions": [
            {
                "id": row.id,
                "file_id": row.file_id,
                "version_no": row.version_no,
                "blob_hash": row.blob_hash,
                "size_bytes": row.size_bytes,
                "commit_message": row.commit_message,
                "author_id": row.author_id,
                "created_at": _dt(row.created_at),
            }
            for row in db.query(FileVersion).order_by(FileVersion.id.asc()).all()
        ],
        "comments": [
            {
                "id": row.id,
                "project_id": row.project_id,
                "file_id": row.file_id,
                "file_version_id": row.file_version_id,
                "author_id": row.author_id,
                "content": row.content,
                "created_at": _dt(row.created_at),
            }
            for row in db.query(Comment).order_by(Comment.id.asc()).all()
        ],
        "comment_mentions": [
            {
                "id": row.id,
                "comment_id": row.comment_id,
                "mentioned_user_id": row.mentioned_user_id,
            }
            for row in db.query(CommentMention).order_by(CommentMention.id.asc()).all()
        ],
        "notifications": [
            {
                "id": row.id,
                "user_id": row.user_id,
                "comment_id": row.comment_id,
                "project_id": row.project_id,
                "file_id": row.file_id,
                "file_version_id": row.file_version_id,
                "actor_id": row.actor_id,
                "type": row.type,
                "message": row.message,
                "is_read": row.is_read,
                "created_at": _dt(row.created_at),
            }
            for row in db.query(Notification).order_by(Notification.id.asc()).all()
        ],
    }


def _stream_full_backup(payload: dict) -> Iterator[bytes]:
    chunks: queue.Queue[bytes | BaseException | None] = queue.Queue(maxsize=32)

    def produce() -> None:
        try:
            with zipfile.ZipFile(_QueueWriter(chunks), "w", zipfile.ZIP_STORED) as zf:
                zf.writestr(
                    "backup.json",
                    json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
                )
                for blob_hash in sorted(
                    {row["blob_hash"] for row in payload["file_versions"]}
                ):
                    try:
                        zf.write(get_blob_path(blob_hash), arcname=f"blobs/{blob_hash}")
                    except FileNotFoundError:
                        continue
        except BaseException as exc:
            chunks.put(exc)
        finally:
            chunks.put(None)

    thread = threading.Thread(target=produce, daemon=True)
    thread.start()

    while True:
        chunk = chunks.get()
        if chunk is None:
            break
        if isinstance(chunk, BaseException):
            raise chunk
        yield chunk


def _write_restored_blob(blob_hash: str, content: bytes) -> None:
    target = BLOB_DIR / blob_hash[:2] / blob_hash[2:]
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)


def _restore_full_backup(db: Session, payload: dict, archive: zipfile.ZipFile) -> None:
    if payload.get("format") != "zgg-full-backup-v1":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "invalid backup format")

    blob_hashes = {row["blob_hash"] for row in payload.get("file_versions", [])}
    missing = [blob_hash for blob_hash in blob_hashes if f"blobs/{blob_hash}" not in archive.namelist()]
    if missing:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"backup missing blobs: {missing[:5]}")

    db.query(FileModel).update({FileModel.current_version_id: None})
    db.query(Notification).delete(synchronize_session=False)
    db.query(CommentMention).delete(synchronize_session=False)
    db.query(Comment).delete(synchronize_session=False)
    db.query(ProjectMember).delete(synchronize_session=False)
    db.query(FileVersion).delete(synchronize_session=False)
    db.query(FileModel).delete(synchronize_session=False)
    db.query(Project).delete(synchronize_session=False)
    db.query(User).delete(synchronize_session=False)
    db.flush()

    for row in payload.get("users", []):
        db.add(
            User(
                id=row["id"],
                username=row["username"],
                email=row["email"],
                password_hash=row["password_hash"],
                is_admin=row["is_admin"],
                ui_language=row.get("ui_language", "zh-CN"),
                ui_theme=row.get("ui_theme", "light"),
                edrawings_exe_path=row.get("edrawings_exe_path"),
                created_at=_parse_dt(row["created_at"]),
            )
        )
    db.flush()

    for row in payload.get("projects", []):
        db.add(
            Project(
                id=row["id"],
                name=row["name"],
                description=row["description"],
                owner_id=row["owner_id"],
                created_at=_parse_dt(row["created_at"]),
            )
        )
    db.flush()

    for row in payload.get("project_members", []):
        db.add(ProjectMember(project_id=row["project_id"], user_id=row["user_id"], role=row["role"]))
    db.flush()

    for row in payload.get("files", []):
        db.add(
            FileModel(
                id=row["id"],
                project_id=row["project_id"],
                name=row["name"],
                current_version_id=None,
                created_at=_parse_dt(row["created_at"]),
            )
        )
    db.flush()

    for row in payload.get("file_versions", []):
        db.add(
            FileVersion(
                id=row["id"],
                file_id=row["file_id"],
                version_no=row["version_no"],
                blob_hash=row["blob_hash"],
                size_bytes=row["size_bytes"],
                commit_message=row["commit_message"],
                author_id=row["author_id"],
                created_at=_parse_dt(row["created_at"]),
            )
        )
    db.flush()

    for row in payload.get("files", []):
        file = db.get(FileModel, row["id"])
        if file:
            file.current_version_id = row["current_version_id"]
    db.flush()

    for row in payload.get("comments", []):
        db.add(
            Comment(
                id=row["id"],
                project_id=row["project_id"],
                file_id=row["file_id"],
                file_version_id=row["file_version_id"],
                author_id=row["author_id"],
                content=row["content"],
                created_at=_parse_dt(row["created_at"]),
            )
        )
    db.flush()

    for row in payload.get("comment_mentions", []):
        db.add(
            CommentMention(
                id=row["id"],
                comment_id=row["comment_id"],
                mentioned_user_id=row["mentioned_user_id"],
            )
        )
    db.flush()

    for row in payload.get("notifications", []):
        db.add(
            Notification(
                id=row["id"],
                user_id=row["user_id"],
                comment_id=row.get("comment_id"),
                project_id=row.get("project_id"),
                file_id=row.get("file_id"),
                file_version_id=row.get("file_version_id"),
                actor_id=row.get("actor_id"),
                type=row["type"],
                message=row.get("message"),
                is_read=row["is_read"],
                created_at=_parse_dt(row["created_at"]),
            )
        )
    db.flush()

    # Backward compat: pre-merge backups stored downloads in a separate array.
    # Fold them in as notifications with comment_id NULL.
    for row in payload.get("download_notifications", []):
        db.add(
            Notification(
                user_id=row["user_id"],
                project_id=row["project_id"],
                file_id=row.get("file_id"),
                file_version_id=row.get("file_version_id"),
                actor_id=row["actor_id"],
                type=row["type"],
                message=row["message"],
                is_read=row["is_read"],
                created_at=_parse_dt(row["created_at"]),
            )
        )

    for blob_hash in blob_hashes:
        _write_restored_blob(blob_hash, archive.read(f"blobs/{blob_hash}"))


def _project_out(p: Project, role: str) -> ProjectOut:
    return ProjectOut(
        id=p.id,
        name=p.name,
        description=p.description,
        owner_id=p.owner_id,
        created_at=p.created_at,
        my_role=role,  # type: ignore[arg-type]
    )


@router.get("", response_model=list[ProjectOut])
def list_my_projects(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[ProjectOut]:
    if user.is_admin:
        projects = db.query(Project).order_by(Project.created_at.desc()).all()
        return [_project_out(project, "owner") for project in projects]

    rows = (
        db.query(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == user.id)
        .order_by(Project.created_at.desc())
        .all()
    )
    return [_project_out(p, role) for p, role in rows]


@router.get("/backup/all")
def download_all_projects_archive(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin only")

    projects = db.query(Project).order_by(Project.created_at.asc(), Project.id.asc()).all()
    entries: list[tuple[str, Path]] = []
    used_names: dict[str, int] = {}
    for project in projects:
        base_name = _safe_zip_name(project.name)
        used_names[base_name] = used_names.get(base_name, 0) + 1
        project_dir = base_name if used_names[base_name] == 1 else f"{base_name}_{project.id}"

        files = db.query(FileModel).filter(FileModel.project_id == project.id).all()
        for file in files:
            if not file.current_version_id:
                continue
            version = db.get(FileVersion, file.current_version_id)
            if not version:
                continue
            try:
                blob_path = get_blob_path(version.blob_hash)
            except FileNotFoundError:
                continue
            entries.append((f"{project_dir}/{file.name}", blob_path))

    encoded = quote("项目备份.zip")
    return StreamingResponse(
        _stream_zip(entries),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=project_backup.zip; filename*=UTF-8''{encoded}"
        },
    )


@router.get("/backup/data/export")
def export_data_backup(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin only")

    payload = _full_backup_payload(db)
    encoded = quote("数据备份.zip")
    return StreamingResponse(
        _stream_full_backup(payload),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=data_backup.zip; filename*=UTF-8''{encoded}"
        },
    )


@router.post("/backup/data/import")
async def import_data_backup(
    upload: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    if not user.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "admin only")

    try:
        content = await upload.read()
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            payload = json.loads(archive.read("backup.json").decode("utf-8"))
            _restore_full_backup(db, payload, archive)
        db.commit()
    except HTTPException:
        db.rollback()
        raise
    except Exception as exc:
        db.rollback()
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"restore failed: {exc}")

    return {"status": "ok"}


@router.post("", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(
    data: ProjectCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    p = Project(name=data.name, description=data.description, owner_id=user.id)
    db.add(p)
    db.flush()
    db.add(ProjectMember(project_id=p.id, user_id=user.id, role="owner"))
    db.commit()
    db.refresh(p)
    # Create an initial (empty) snapshot so the project has a HEAD from the start.
    from ..commit_service import create_commit

    create_commit(db, p, user, "项目初始化")
    db.commit()
    db.refresh(p)
    return _project_out(p, "owner")


@router.get("/{pid}", response_model=ProjectOut)
def get_project(
    pid: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ProjectOut:
    p = get_project_or_404(pid, db)
    role = get_effective_project_role(db, pid, user)
    if role is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "not a project member")
    return _project_out(p, role)


@router.get("/{pid}/download")
def download_project(
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> StreamingResponse:
    p, user, _ = ctx
    files = db.query(FileModel).filter(FileModel.project_id == p.id).all()

    entries: list[tuple[str, Path]] = []
    for f in files:
        if not f.current_version_id:
            continue
        v = db.get(FileVersion, f.current_version_id)
        if not v:
            continue
        try:
            blob_path = get_blob_path(v.blob_hash)
        except FileNotFoundError:
            continue
        entries.append((f.name, blob_path))

    create_project_download_notifications(db, p, user)
    db.commit()

    encoded = quote(f"{p.name}.zip")
    return StreamingResponse(
        _stream_zip(entries),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=project_{p.id}.zip; filename*=UTF-8''{encoded}"
        },
    )


@router.delete("/{pid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    ctx: tuple[Project, User, str] = Depends(require_project_role("owner")),
    db: Session = Depends(get_db),
) -> None:
    p, _, _ = ctx
    pid = p.id

    # Cascade-delete all dependent data explicitly. File/FileVersion/Comment/etc.
    # have no ORM relationship back to Project, so deleting the Project row alone
    # would orphan them; with SQLite reusing autoincrement ids after a delete,
    # a newly created project could otherwise inherit a previous project's files.
    file_ids = [
        row[0]
        for row in db.query(FileModel.id).filter(FileModel.project_id == pid).all()
    ]

    if file_ids:
        version_ids = [
            row[0]
            for row in db.query(FileVersion.id).filter(FileVersion.file_id.in_(file_ids)).all()
        ]
        # Comments and their mentions
        comment_ids = [
            row[0]
            for row in db.query(Comment.id).filter(Comment.file_id.in_(file_ids)).all()
        ]
        if comment_ids:
            db.query(CommentMention).filter(
                CommentMention.comment_id.in_(comment_ids)
            ).delete(synchronize_session=False)
            db.query(Notification).filter(
                Notification.comment_id.in_(comment_ids)
            ).delete(synchronize_session=False)
            db.query(Comment).filter(Comment.id.in_(comment_ids)).delete(
                synchronize_session=False
            )
        # Download notifications referencing these files (unified table)
        db.query(Notification).filter(
            Notification.file_id.in_(file_ids)
        ).delete(synchronize_session=False)
        # File versions and files (clear current_version_id FK first)
        db.query(FileModel).filter(FileModel.project_id == pid).update(
            {FileModel.current_version_id: None}, synchronize_session=False
        )
        db.query(FileVersion).filter(FileVersion.file_id.in_(file_ids)).delete(
            synchronize_session=False
        )
        db.query(FileModel).filter(FileModel.id.in_(file_ids)).delete(
            synchronize_session=False
        )

    # Download notifications referencing the project directly
    db.query(Notification).filter(
        Notification.project_id == pid
    ).delete(synchronize_session=False)

    # ProjectMember is removed via the Project cascade, but delete explicitly
    # to be safe regardless of relationship/cascade config.
    db.query(ProjectMember).filter(ProjectMember.project_id == pid).delete(
        synchronize_session=False
    )

    # Delete all project snapshots (commits + their trees) and clear HEAD.
    from ..models import ProjectCommit, ProjectCommitFile

    commit_ids = [
        row[0]
        for row in db.query(ProjectCommit.id).filter(ProjectCommit.project_id == pid).all()
    ]
    if commit_ids:
        db.query(ProjectCommitFile).filter(
            ProjectCommitFile.commit_id.in_(commit_ids)
        ).delete(synchronize_session=False)
        db.query(ProjectCommit).filter(ProjectCommit.id.in_(commit_ids)).delete(
            synchronize_session=False
        )
    p.head_commit_id = None

    db.delete(p)
    db.commit()


@router.get("/{pid}/members", response_model=list[MemberOut])
def list_members(
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> list[MemberOut]:
    p, _, _ = ctx
    members = (
        db.query(ProjectMember, User)
        .join(User, User.id == ProjectMember.user_id)
        .filter(ProjectMember.project_id == p.id)
        .all()
    )
    return [
        MemberOut(user_id=u.id, username=u.username, email=u.email, role=m.role)  # type: ignore[arg-type]
        for m, u in members
    ]


@router.post("/{pid}/members", response_model=MemberOut, status_code=status.HTTP_201_CREATED)
def add_member(
    data: MemberAdd,
    ctx: tuple[Project, User, str] = Depends(require_project_role("owner")),
    db: Session = Depends(get_db),
) -> MemberOut:
    p, _, _ = ctx
    user = db.query(User).filter_by(username=data.username).first()
    if not user:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"user '{data.username}' not found")
    if db.query(ProjectMember).filter_by(project_id=p.id, user_id=user.id).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "user is already a member")
    if data.role == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot add another owner")
    m = ProjectMember(project_id=p.id, user_id=user.id, role=data.role)
    db.add(m)
    db.commit()
    return MemberOut(user_id=user.id, username=user.username, email=user.email, role=data.role)


@router.patch("/{pid}/members/{uid}", response_model=MemberOut)
def update_member(
    uid: int,
    data: MemberUpdate,
    ctx: tuple[Project, User, str] = Depends(require_project_role("owner")),
    db: Session = Depends(get_db),
) -> MemberOut:
    p, _, _ = ctx
    m = db.query(ProjectMember).filter_by(project_id=p.id, user_id=uid).first()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if m.role == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot change owner role")
    if data.role == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot promote to owner")
    m.role = data.role
    db.commit()
    user = db.get(User, uid)
    return MemberOut(user_id=user.id, username=user.username, email=user.email, role=m.role)  # type: ignore[arg-type]


@router.delete("/{pid}/members/{uid}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    uid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("owner")),
    db: Session = Depends(get_db),
) -> None:
    p, _, _ = ctx
    m = db.query(ProjectMember).filter_by(project_id=p.id, user_id=uid).first()
    if not m:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "member not found")
    if m.role == "owner":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "cannot remove owner")
    db.delete(m)
    db.commit()
