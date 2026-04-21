from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_current_user, get_db
from ..models import User
from ..schemas import Token, UserCreate, UserLogin, UserOut, UserSettingsUpdate
from ..security import create_access_token, hash_password, verify_password


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)) -> User:
    if db.query(User).filter_by(username=data.username).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "username already taken")
    if db.query(User).filter_by(email=data.email).first():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "email already registered")
    user = User(
        username=data.username,
        email=data.email,
        password_hash=hash_password(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)) -> Token:
    user = db.query(User).filter_by(username=data.username).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid username or password")
    token = create_access_token(user.id)
    return Token(access_token=token)


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> User:
    return user


@router.patch("/me/settings", response_model=UserOut)
def update_my_settings(
    data: UserSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> User:
    payload = data.model_dump(exclude_unset=True)
    if "ui_language" in payload and payload["ui_language"] is not None:
        user.ui_language = payload["ui_language"]
    if "ui_theme" in payload and payload["ui_theme"] is not None:
        user.ui_theme = payload["ui_theme"]
    if "edrawings_exe_path" in payload:
        raw_path = payload["edrawings_exe_path"]
        user.edrawings_exe_path = raw_path.strip() if raw_path and raw_path.strip() else None
    db.commit()
    db.refresh(user)
    return user
