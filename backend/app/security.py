from datetime import datetime, timedelta
from typing import Any

from jose import JWTError, jwt
from passlib.context import CryptContext

from .config import settings


pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    return pwd_ctx.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_ctx.verify(password, hashed)


def create_access_token(subject: str | int) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.jwt_expire_days)
    payload = {"sub": str(subject), "exp": expire}
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_edrawings_open_ticket(
    *,
    project_id: int,
    file_id: int,
    version_id: int,
    actor_id: int,
    expires_minutes: int = 5,
) -> str:
    expire = datetime.utcnow() + timedelta(minutes=expires_minutes)
    payload = {
        "purpose": "edrawings_open",
        "pid": project_id,
        "fid": file_id,
        "vid": version_id,
        "actor_id": actor_id,
        "exp": expire,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> dict[str, Any]:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    except JWTError as e:
        raise ValueError("invalid token") from e


def decode_edrawings_open_ticket(token: str) -> dict[str, int]:
    payload = decode_token(token)
    if payload.get("purpose") != "edrawings_open":
        raise ValueError("invalid token")
    try:
        return {
            "project_id": int(payload["pid"]),
            "file_id": int(payload["fid"]),
            "version_id": int(payload["vid"]),
            "actor_id": int(payload["actor_id"]),
        }
    except (KeyError, TypeError, ValueError) as e:
        raise ValueError("invalid token") from e
