from sqlalchemy.orm import Session

from .config import settings
from .database import SessionLocal
from .models import User
from .security import hash_password


def ensure_default_admin() -> None:
    db: Session = SessionLocal()
    try:
        admin = db.query(User).filter_by(username=settings.admin_username).first()
        if admin:
            if not admin.is_admin:
                admin.is_admin = True
                db.commit()
            return

        admin = User(
            username=settings.admin_username,
            email=settings.admin_email,
            password_hash=hash_password(settings.admin_password),
            is_admin=True,
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
