from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from .config import settings


engine = create_engine(
    settings.database_url,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


def _migrate_users_table() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("users")}
    with engine.begin() as conn:
        if "is_admin" not in column_names:
            conn.execute(
                text("ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT 0")
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


def _migrate_file_versions_table() -> None:
    inspector = inspect(engine)
    if "file_versions" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("file_versions")}
    with engine.begin() as conn:
        if "step_blob_hash" not in column_names:
            conn.execute(
                text("ALTER TABLE file_versions ADD COLUMN step_blob_hash VARCHAR(64)")
            )


def _migrate_files_is_deleted() -> None:
    """Add is_deleted soft-delete column to files if missing."""
    inspector = inspect(engine)
    if "files" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("files")}
    if "is_deleted" not in column_names:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE files ADD COLUMN is_deleted BOOLEAN NOT NULL DEFAULT 0")
            )


def _migrate_projects_head_commit() -> None:
    """Add head_commit_id column to projects if missing."""
    inspector = inspect(engine)
    if "projects" not in inspector.get_table_names():
        return
    column_names = {column["name"] for column in inspector.get_columns("projects")}
    if "head_commit_id" not in column_names:
        with engine.begin() as conn:
            conn.execute(
                text("ALTER TABLE projects ADD COLUMN head_commit_id INTEGER")
            )


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _migrate_users_table()
    _migrate_file_versions_table()
    _migrate_files_is_deleted()
    _migrate_projects_head_commit()

    # Backfill initial commits for pre-existing projects.
    from .commit_service import backfill_initial_commits
    from .database import SessionLocal

    db = SessionLocal()
    try:
        backfill_initial_commits(db)
    finally:
        db.close()
