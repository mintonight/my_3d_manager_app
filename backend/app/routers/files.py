from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse, Response
from sqlalchemy.orm import Session

import hashlib
import httpx

from ..deps import get_db, require_project_role
from ..models import File as FileModel
from ..models import FileVersion, Project, User
from ..preview import extract_solidworks_thumbnail, list_ole_streams
from ..schemas import FileOut, FileVersionOut
from ..storage import get_blob_path, save_blob


router = APIRouter(prefix="/api/projects/{pid}/files", tags=["files"])

JLC_VIEWER_API = "https://api.forface3d.com/forface/model/viewer/browser/v1/uploadModel"
JLC_VIEWER_URL = "https://3d-viewer.jlc.com/viewer"
JLC_MAX_UPLOAD_BYTES = 100 * 1024 * 1024


def _file_out(f: FileModel, db: Session) -> FileOut:
    version_no = None
    if f.current_version_id:
        v = db.get(FileVersion, f.current_version_id)
        version_no = v.version_no if v else None
    return FileOut(
        id=f.id,
        name=f.name,
        current_version_no=version_no,
        current_version_id=f.current_version_id,
        created_at=f.created_at,
    )


def _sanitize_rel_path(raw: str) -> str:
    """Normalize and validate a relative path; reject absolute, traversal, NUL."""
    stripped = raw.strip()
    if not stripped or "\0" in stripped:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid path: {raw!r}")
    # Reject absolute paths (Unix or Windows) before normalization
    if stripped.startswith(("/", "\\")):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"absolute path not allowed: {raw!r}")
    if len(stripped) >= 2 and stripped[1] == ":":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"absolute path not allowed: {raw!r}")
    norm = stripped.replace("\\", "/")
    parts = norm.split("/")
    if any(p in ("", "..") for p in parts):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"invalid path: {raw!r}")
    if len(norm) > 255:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"path too long: {raw!r}")
    return norm


@router.get("", response_model=list[FileOut])
def list_files(
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> list[FileOut]:
    p, _, _ = ctx
    files = (
        db.query(FileModel)
        .filter(FileModel.project_id == p.id)
        .order_by(FileModel.created_at.desc())
        .all()
    )
    return [_file_out(f, db) for f in files]


@router.post("", response_model=FileOut, status_code=status.HTTP_201_CREATED)
async def upload_new_file(
    upload: UploadFile = File(...),
    commit_message: str = Form(default=""),
    ctx: tuple[Project, User, str] = Depends(require_project_role("editor")),
    db: Session = Depends(get_db),
) -> FileOut:
    p, user, _ = ctx
    name = _sanitize_rel_path(upload.filename or "unnamed")
    existing = db.query(FileModel).filter_by(project_id=p.id, name=name).first()
    if existing:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"file '{name}' already exists; use commit endpoint to add a new version",
        )
    content = await upload.read()
    blob_hash = save_blob(content)

    f = FileModel(project_id=p.id, name=name)
    db.add(f)
    db.flush()
    v = FileVersion(
        file_id=f.id,
        version_no=1,
        blob_hash=blob_hash,
        size_bytes=len(content),
        commit_message=commit_message or "initial upload",
        author_id=user.id,
    )
    db.add(v)
    db.flush()
    f.current_version_id = v.id
    db.commit()
    db.refresh(f)
    return _file_out(f, db)


@router.post("/folder", response_model=list[FileOut], status_code=status.HTTP_201_CREATED)
async def upload_folder(
    uploads: list[UploadFile] = File(...),
    paths: list[str] = Form(...),
    commit_message: str = Form(default=""),
    ctx: tuple[Project, User, str] = Depends(require_project_role("editor")),
    db: Session = Depends(get_db),
) -> list[FileOut]:
    p, user, _ = ctx
    if len(uploads) != len(paths):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST,
            f"uploads ({len(uploads)}) and paths ({len(paths)}) length mismatch",
        )
    if not uploads:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "empty upload")

    clean_paths = [_sanitize_rel_path(p_) for p_ in paths]

    results: list[FileModel] = []
    for upload, rel_path in zip(uploads, clean_paths):
        content = await upload.read()
        blob_hash = save_blob(content)
        existing = db.query(FileModel).filter_by(project_id=p.id, name=rel_path).first()
        msg = commit_message or f"folder upload: {rel_path}"

        if existing:
            max_no = (
                db.query(FileVersion.version_no)
                .filter(FileVersion.file_id == existing.id)
                .order_by(FileVersion.version_no.desc())
                .first()
            )
            next_no = (max_no[0] if max_no else 0) + 1
            v = FileVersion(
                file_id=existing.id,
                version_no=next_no,
                blob_hash=blob_hash,
                size_bytes=len(content),
                commit_message=msg,
                author_id=user.id,
            )
            db.add(v)
            db.flush()
            existing.current_version_id = v.id
            results.append(existing)
        else:
            f = FileModel(project_id=p.id, name=rel_path)
            db.add(f)
            db.flush()
            v = FileVersion(
                file_id=f.id,
                version_no=1,
                blob_hash=blob_hash,
                size_bytes=len(content),
                commit_message=msg,
                author_id=user.id,
            )
            db.add(v)
            db.flush()
            f.current_version_id = v.id
            results.append(f)

    db.commit()
    for f in results:
        db.refresh(f)
    return [_file_out(f, db) for f in results]


@router.post("/{fid}/commit", response_model=FileVersionOut, status_code=status.HTTP_201_CREATED)
async def commit_new_version(
    fid: int,
    upload: UploadFile = File(...),
    commit_message: str = Form(default=""),
    ctx: tuple[Project, User, str] = Depends(require_project_role("editor")),
    db: Session = Depends(get_db),
) -> FileVersionOut:
    p, user, _ = ctx
    f = db.get(FileModel, fid)
    if not f or f.project_id != p.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    content = await upload.read()
    new_hash = hashlib.sha256(content).hexdigest()

    if f.current_version_id:
        current = db.get(FileVersion, f.current_version_id)
        if current and current.blob_hash == new_hash:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"文件未改动，无法提交，请确认文件版本（当前已是 v{current.version_no}）",
            )

    save_blob(content)  # hash equals new_hash; idempotent

    max_no = (
        db.query(FileVersion.version_no)
        .filter(FileVersion.file_id == fid)
        .order_by(FileVersion.version_no.desc())
        .first()
    )
    next_no = (max_no[0] if max_no else 0) + 1

    v = FileVersion(
        file_id=fid,
        version_no=next_no,
        blob_hash=new_hash,
        size_bytes=len(content),
        commit_message=commit_message,
        author_id=user.id,
    )
    db.add(v)
    db.flush()
    f.current_version_id = v.id
    db.commit()
    db.refresh(v)
    return FileVersionOut(
        id=v.id,
        version_no=v.version_no,
        blob_hash=v.blob_hash,
        size_bytes=v.size_bytes,
        commit_message=v.commit_message,
        author_id=v.author_id,
        author_username=user.username,
        created_at=v.created_at,
        is_current=True,
    )


@router.get("/{fid}/versions", response_model=list[FileVersionOut])
def list_versions(
    fid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> list[FileVersionOut]:
    p, _, _ = ctx
    f = db.get(FileModel, fid)
    if not f or f.project_id != p.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    rows = (
        db.query(FileVersion, User)
        .join(User, User.id == FileVersion.author_id)
        .filter(FileVersion.file_id == fid)
        .order_by(FileVersion.version_no.desc())
        .all()
    )
    current_id = f.current_version_id
    return [
        FileVersionOut(
            id=v.id,
            version_no=v.version_no,
            blob_hash=v.blob_hash,
            size_bytes=v.size_bytes,
            commit_message=v.commit_message,
            author_id=v.author_id,
            author_username=u.username,
            created_at=v.created_at,
            is_current=(v.id == current_id),
        )
        for v, u in rows
    ]


@router.get("/{fid}/versions/{vid}/download")
def download_version(
    fid: int,
    vid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> FileResponse:
    p, _, _ = ctx
    f = db.get(FileModel, fid)
    if not f or f.project_id != p.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    v = db.get(FileVersion, vid)
    if not v or v.file_id != fid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "version not found")
    try:
        path = get_blob_path(v.blob_hash)
    except FileNotFoundError:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "blob missing from storage")
    return FileResponse(
        path,
        filename=f"{f.name}.v{v.version_no}",
        media_type="application/octet-stream",
    )


@router.post("/{fid}/versions/{vid}/jlc-preview")
def create_jlc_preview(
    fid: int,
    vid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    p, _, _ = ctx
    f = db.get(FileModel, fid)
    if not f or f.project_id != p.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    v = db.get(FileVersion, vid)
    if not v or v.file_id != fid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "version not found")
    if v.size_bytes > JLC_MAX_UPLOAD_BYTES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "嘉立创在线预览仅支持不超过 100MB 的文件")
    try:
        path = get_blob_path(v.blob_hash)
    except FileNotFoundError:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "blob missing from storage")

    filename = f.name.replace("\\", "/").split("/")[-1] or f.name
    try:
        with path.open("rb") as file_obj:
            response = httpx.post(
                JLC_VIEWER_API,
                headers={"System-Sources-Side": "Web", "token": ""},
                files={"file": (filename, file_obj, "application/octet-stream")},
                timeout=120,
            )
        response.raise_for_status()
        payload = response.json()
    except Exception as exc:
        raise HTTPException(
            status.HTTP_502_BAD_GATEWAY,
            f"嘉立创在线预览上传失败: {exc}",
        )

    data = payload.get("data") if isinstance(payload, dict) else None
    if not isinstance(data, dict) or not payload.get("success"):
        detail = payload.get("msg") if isinstance(payload, dict) else "unknown response"
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, f"嘉立创在线预览上传失败: {detail}")

    model_id = data.get("modelId")
    token_key = data.get("tokenKey")
    if not model_id or not token_key:
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, "嘉立创在线预览未返回模型地址")

    return {"url": f"{JLC_VIEWER_URL}?modelId={model_id}&tokenKey={token_key}"}


@router.get("/{fid}/versions/{vid}/thumbnail")
def version_thumbnail(
    fid: int,
    vid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> Response:
    """Extract an embedded preview image from an OLE-based CAD file.

    Works for SolidWorks .sldprt / .sldasm / .slddrw — the underlying
    Compound File typically carries a PNG or JPEG preview stream.
    """
    p, _, _ = ctx
    f = db.get(FileModel, fid)
    if not f or f.project_id != p.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    v = db.get(FileVersion, vid)
    if not v or v.file_id != fid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "version not found")
    try:
        path = get_blob_path(v.blob_hash)
    except FileNotFoundError:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "blob missing from storage")

    data = path.read_bytes()
    result = extract_solidworks_thumbnail(data)
    if not result:
        streams = list_ole_streams(data)
        detail = "no embedded thumbnail found"
        if streams:
            detail += f"; streams inspected: {streams[:20]}"
        raise HTTPException(status.HTTP_404_NOT_FOUND, detail)
    image_bytes, mime = result
    return Response(
        content=image_bytes,
        media_type=mime,
        headers={"Cache-Control": "private, max-age=3600"},
    )


@router.post("/{fid}/rollback/{vid}", response_model=FileOut)
def rollback_to_version(
    fid: int,
    vid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("editor")),
    db: Session = Depends(get_db),
) -> FileOut:
    p, _, _ = ctx
    f = db.get(FileModel, fid)
    if not f or f.project_id != p.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    v = db.get(FileVersion, vid)
    if not v or v.file_id != fid:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "version not found")
    f.current_version_id = v.id
    db.commit()
    db.refresh(f)
    return _file_out(f, db)


@router.delete("/{fid}", status_code=status.HTTP_204_NO_CONTENT)
def delete_file(
    fid: int,
    ctx: tuple[Project, User, str] = Depends(require_project_role("owner")),
    db: Session = Depends(get_db),
) -> None:
    p, _, _ = ctx
    f = db.get(FileModel, fid)
    if not f or f.project_id != p.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "file not found")
    f.current_version_id = None
    db.flush()
    db.query(FileVersion).filter(FileVersion.file_id == fid).delete()
    db.delete(f)
    db.commit()
