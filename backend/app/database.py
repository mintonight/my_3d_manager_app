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


# Columns introduced after first release; added to pre-existing SQLite DBs on
# startup. Each tuple: (table, column, "TYPE [DEFAULT ...]" appended after
# ADD COLUMN). Values are static literals, never user input.
_ADD_COLUMN_MIGRATIONS = [
    ("users", "is_admin", "BOOLEAN NOT NULL DEFAULT 0"),
    ("users", "ui_language", "VARCHAR(16) NOT NULL DEFAULT 'zh-CN'"),
    ("users", "ui_theme", "VARCHAR(16) NOT NULL DEFAULT 'light'"),
    ("users", "edrawings_exe_path", "VARCHAR(512)"),
    ("file_versions", "step_blob_hash", "VARCHAR(64)"),
    ("files", "is_deleted", "BOOLEAN NOT NULL DEFAULT 0"),
    ("projects", "head_commit_id", "INTEGER"),
]


def _run_migrations() -> None:
    """Add any missing columns to existing tables (idempotent)."""
    inspector = inspect(engine)
    tables = set(inspector.get_table_names())

    # Group per table so each table alters in a single transaction.
    by_table: dict[str, list[tuple[str, str]]] = {}
    for table, column, ddl in _ADD_COLUMN_MIGRATIONS:
        if table in tables:
            by_table.setdefault(table, []).append((column, ddl))

    for table, columns in by_table.items():
        existing = {c["name"] for c in inspector.get_columns(table)}
        missing = [(col, ddl) for col, ddl in columns if col not in existing]
        if not missing:
            continue
        with engine.begin() as conn:
            for column, ddl in missing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {column} {ddl}"))


def _migrate_merge_notifications() -> None:
    """One-time: fold the old download_notifications table into notifications.

    Mention and download notifications used to live in two tables reconciled in
    the API via negative ids; they are now one table. SQLite cannot drop a NOT
    NULL constraint via ALTER, so the notifications table is rebuilt with a
    nullable comment_id plus the new download columns, existing mention rows are
    copied across, then download_notifications rows are folded in (comment_id
    NULL) and that table is dropped. No-op on fresh or already-merged DBs.
    """
    inspector = inspect(engine)
    if "notifications" not in inspector.get_table_names():
        return
    if "message" in {c["name"] for c in inspector.get_columns("notifications")}:
        return  # already merged
    has_download = "download_notifications" in inspector.get_table_names()

    with engine.begin() as conn:
        conn.execute(text(
            "CREATE TABLE notifications_new ("
            "id INTEGER PRIMARY KEY,"
            "user_id INTEGER REFERENCES users(id),"
            "comment_id INTEGER REFERENCES comments(id),"
            "project_id INTEGER REFERENCES projects(id),"
            "file_id INTEGER REFERENCES files(id),"
            "file_version_id INTEGER REFERENCES file_versions(id),"
            "actor_id INTEGER REFERENCES users(id),"
            "type VARCHAR(32) DEFAULT 'mention',"
            "message VARCHAR(512),"
            "is_read BOOLEAN NOT NULL DEFAULT 0,"
            "created_at DATETIME,"
            "CONSTRAINT uq_notification_user_comment_type UNIQUE (user_id, comment_id, type)"
            ")"
        ))
        conn.execute(text(
            "INSERT INTO notifications_new "
            "(id, user_id, comment_id, type, is_read, created_at) "
            "SELECT id, user_id, comment_id, type, is_read, created_at FROM notifications"
        ))
        conn.execute(text("DROP TABLE notifications"))
        conn.execute(text("ALTER TABLE notifications_new RENAME TO notifications"))
        conn.execute(text("CREATE INDEX ix_notifications_user_id ON notifications (user_id)"))
        conn.execute(text("CREATE INDEX ix_notifications_comment_id ON notifications (comment_id)"))
        if has_download:
            conn.execute(text(
                "INSERT INTO notifications "
                "(user_id, comment_id, project_id, file_id, file_version_id, actor_id, type, message, is_read, created_at) "
                "SELECT user_id, NULL, project_id, file_id, file_version_id, actor_id, type, message, is_read, created_at "
                "FROM download_notifications"
            ))
            conn.execute(text("DROP TABLE download_notifications"))


def init_db() -> None:
    from . import models  # noqa: F401

    Base.metadata.create_all(bind=engine)
    _run_migrations()
    _migrate_merge_notifications()

    # Backfill initial commits for pre-existing projects.
    from .commit_service import backfill_initial_commits
    from .database import SessionLocal

    db = SessionLocal()
    try:
        backfill_initial_commits(db)
    finally:
        db.close()
