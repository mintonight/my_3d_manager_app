from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db, require_project_role
from ..models import File as FileModel
from ..models import FileVersion, Project, ProjectMember, User
from ..schemas import SearchResultFileOut, SearchResultOut, SearchResultProjectOut


router = APIRouter(tags=["search"])


def _normalized_query(q: str) -> str:
    return q.strip().lower()


def _project_out(project: Project, role: str) -> SearchResultProjectOut:
    return SearchResultProjectOut(
        id=project.id,
        name=project.name,
        description=project.description,
        owner_id=project.owner_id,
        created_at=project.created_at,
        my_role=role,  # type: ignore[arg-type]
    )


def _file_out(file: FileModel, project_name: str, db: Session) -> SearchResultFileOut:
    current_version_no = None
    if file.current_version_id:
        version = db.get(FileVersion, file.current_version_id)
        current_version_no = version.version_no if version else None
    return SearchResultFileOut(
        id=file.id,
        name=file.name,
        project_id=file.project_id,
        project_name=project_name,
        current_version_no=current_version_no,
        current_version_id=file.current_version_id,
        created_at=file.created_at,
    )


@router.get("/api/search", response_model=SearchResultOut)
def global_search(
    q: str = Query(default=""),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SearchResultOut:
    query = _normalized_query(q)
    if not query:
        return SearchResultOut(projects=[], files=[])

    pattern = f"%{query}%"

    if user.is_admin:
        projects = (
            db.query(Project)
            .filter(func.lower(Project.name).like(pattern))
            .order_by(Project.created_at.desc())
            .all()
        )
        files = (
            db.query(FileModel, Project.name)
            .join(Project, Project.id == FileModel.project_id)
            .filter(func.lower(FileModel.name).like(pattern))
            .order_by(FileModel.created_at.desc())
            .all()
        )
        return SearchResultOut(
            projects=[_project_out(project, "owner") for project in projects],
            files=[_file_out(file, project_name, db) for file, project_name in files],
        )

    projects = (
        db.query(Project, ProjectMember.role)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == user.id)
        .filter(func.lower(Project.name).like(pattern))
        .order_by(Project.created_at.desc())
        .all()
    )
    files = (
        db.query(FileModel, Project.name)
        .join(Project, Project.id == FileModel.project_id)
        .join(ProjectMember, ProjectMember.project_id == Project.id)
        .filter(ProjectMember.user_id == user.id)
        .filter(func.lower(FileModel.name).like(pattern))
        .order_by(FileModel.created_at.desc())
        .all()
    )
    return SearchResultOut(
        projects=[_project_out(project, role) for project, role in projects],
        files=[_file_out(file, project_name, db) for file, project_name in files],
    )


@router.get("/api/projects/{pid}/search", response_model=list[SearchResultFileOut])
def search_project_files(
    q: str = Query(default=""),
    ctx: tuple[Project, User, str] = Depends(require_project_role("viewer")),
    db: Session = Depends(get_db),
) -> list[SearchResultFileOut]:
    project, _, _ = ctx
    query = _normalized_query(q)
    if not query:
        return []

    files = (
        db.query(FileModel)
        .filter(FileModel.project_id == project.id)
        .filter(func.lower(FileModel.name).like(f"%{query}%"))
        .order_by(FileModel.created_at.desc())
        .all()
    )
    return [_file_out(file, project.name, db) for file in files]
