from collections.abc import Iterator
from pathlib import Path
import queue
import threading
import zipfile
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..deps import (
    get_current_user,
    get_db,
    get_effective_project_role,
    get_project_or_404,
    require_project_role,
)
from ..models import File as FileModel
from ..models import FileVersion, Project, ProjectMember, User
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
def download_all_projects_backup(
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

    encoded = quote("数据备份.zip")
    return StreamingResponse(
        _stream_zip(entries),
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename=data_backup.zip; filename*=UTF-8''{encoded}"
        },
    )


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
    p, _, _ = ctx
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
