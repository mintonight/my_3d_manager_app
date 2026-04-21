from typing import Generator

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from .database import SessionLocal
from .models import Project, ProjectMember, User
from .security import decode_token


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

ROLE_LEVEL = {"viewer": 1, "editor": 2, "owner": 3}


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    token: str | None = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing token")
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid token")
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "user not found")
    return user


def get_project_or_404(pid: int, db: Session) -> Project:
    project = db.get(Project, pid)
    if not project:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "project not found")
    return project


def get_my_role(db: Session, project_id: int, user_id: int) -> str | None:
    m = db.query(ProjectMember).filter_by(project_id=project_id, user_id=user_id).first()
    return m.role if m else None


def get_effective_project_role(db: Session, project_id: int, user: User) -> str | None:
    if user.is_admin:
        return "owner"
    return get_my_role(db, project_id, user.id)


def require_project_role(min_role: str):
    min_level = ROLE_LEVEL[min_role]

    def _dep(
        pid: int,
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> tuple[Project, User, str]:
        project = get_project_or_404(pid, db)
        role = get_effective_project_role(db, pid, user)
        if role is None:
            raise HTTPException(status.HTTP_403_FORBIDDEN, "not a project member")
        if ROLE_LEVEL[role] < min_level:
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"requires {min_role} role")
        return project, user, role

    return _dep
