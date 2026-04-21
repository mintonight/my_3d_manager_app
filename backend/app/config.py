from pathlib import Path
from pydantic_settings import BaseSettings


BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
BLOB_DIR = DATA_DIR / "blobs"
DEFAULT_EDRAWINGS_EXE_PATH = Path(r"C:\Program Files\SOLIDWORKS Corp\eDrawings\eDrawings.exe")
DEFAULT_EDRAWINGS_CACHE_DIR = DATA_DIR / "edrawings"


class Settings(BaseSettings):
    database_url: str = f"sqlite:///{(DATA_DIR / 'app.db').as_posix()}"
    auto_create_tables: bool = True
    jwt_secret: str = "change-me-in-production-zhuiguang-geometry-lite"
    jwt_algorithm: str = "HS256"
    jwt_expire_days: int = 7
    admin_username: str = "superadmin"
    admin_email: str = "superadmin@example.com"
    admin_password: str = "superadmin"
    edrawings_exe_path: Path = DEFAULT_EDRAWINGS_EXE_PATH
    edrawings_cache_dir: Path = DEFAULT_EDRAWINGS_CACHE_DIR

    class Config:
        env_prefix = "ZGG_"


settings = Settings()

DATA_DIR.mkdir(parents=True, exist_ok=True)
BLOB_DIR.mkdir(parents=True, exist_ok=True)
settings.edrawings_cache_dir.mkdir(parents=True, exist_ok=True)
