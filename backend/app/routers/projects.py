import io
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

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
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
            zf.write(blob_path, arcname=f.name)
    buf.seek(0)

    encoded = quote(f"{p.name}.zip")
    return StreamingResponse(
        buf,
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
