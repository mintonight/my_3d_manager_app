from pathlib import Path
from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
BLOB_DIR = DATA_DIR / "blobs"


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"
    jwt_secret: str = "change-me-in-production-zhuiguang-geometry-lite"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7
    admin_username: str = "superadmin"
    admin_email: str = "superadmin@example.com"
    admin_password: str = "superadmin"

    class Config:
        env_prefix = "ZGG_"


settings = Settings()

DATA_DIR.mkdir(parents=True, exist_ok=True)
BLOB_DIR.mkdir(parents=True, exist_ok=True)
