from sqlalchemy import Engine, create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


def _engine_kwargs(database_url: str) -> dict:
    if database_url.startswith("sqlite"):
        return {"connect_args": {"check_same_thread": False}}
    return {"pool_pre_ping": True}


engine = create_engine(settings.database_url, **_engine_kwargs(settings.database_url))

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _migrate_users_table(target_engine: Engine) -> None:
    inspector = inspect(target_engine)
    if "users" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("users")}
    bool_default = "0" if target_engine.dialect.name == "sqlite" else "false"
    with target_engine.begin() as conn:
        if "is_admin" not in column_names:
            conn.execute(
                text(f"ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT {bool_default}")
            )
        if "ui_language" not in column_names:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN ui_language VARCHAR(16) NOT NULL DEFAULT 'zh-CN'")
            )
        if "ui_theme" not in column_names:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN ui_theme VARCHAR(16) NOT NULL DEFAULT 'light'")
            )
        if "edrawings_exe_path" not in column_names:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN edrawings_exe_path VARCHAR(512)")
            )


def init_db() -> None:
    from . import models  # noqa: F401

    if settings.auto_create_tables:
        Base.metadata.create_all(bind=engine)
        _migrate_users_table(engine)
