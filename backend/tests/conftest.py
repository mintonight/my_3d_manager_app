import importlib
import os
import sys
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from uuid import uuid4

from alembic import command
from alembic.config import Config
import psycopg
from psycopg import sql
import pytest
from fastapi.testclient import TestClient


def _clear_app_modules() -> None:
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]


def _database_url_for_name(database_url: str, database_name: str) -> str:
    parts = urlsplit(database_url)
    return urlunsplit((parts.scheme, parts.netloc, f"/{database_name}", "", ""))


def _psycopg_url(database_url: str) -> str:
    return database_url.replace("postgresql+psycopg://", "postgresql://", 1)


def _create_database(admin_url: str, database_name: str) -> None:
    with psycopg.connect(_psycopg_url(admin_url), autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database_name))
            )


def _drop_database(admin_url: str, database_name: str) -> None:
    with psycopg.connect(_psycopg_url(admin_url), autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                sql.SQL("DROP DATABASE IF EXISTS {} WITH (FORCE)").format(
                    sql.Identifier(database_name)
                )
            )


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    blob_dir = tmp_path / "blobs"
    base_url = os.environ.get("ZGG_DATABASE_URL")
    if not base_url:
        raise RuntimeError("ZGG_DATABASE_URL must point to a PostgreSQL database for tests")
    test_db_name = f"zgg_test_{uuid4().hex}"
    admin_url = _database_url_for_name(base_url, "postgres")
    test_url = _database_url_for_name(base_url, test_db_name)

    _create_database(admin_url, test_db_name)

    monkeypatch.setenv("ZGG_DATABASE_URL", test_url)
    monkeypatch.setenv("ZGG_ADMIN_USERNAME", "superadmin")
    monkeypatch.setenv("ZGG_ADMIN_EMAIL", "superadmin@example.com")
    monkeypatch.setenv("ZGG_ADMIN_PASSWORD", "superadmin")

    _clear_app_modules()
    alembic_cfg = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    command.upgrade(alembic_cfg, "head")

    main = importlib.import_module("app.main")
    storage = importlib.import_module("app.storage")
    config = importlib.import_module("app.config")

    blob_dir.mkdir(parents=True, exist_ok=True)
    storage.BLOB_DIR = blob_dir
    config.BLOB_DIR = blob_dir

    try:
        with TestClient(main.app) as test_client:
            yield test_client
    finally:
        _clear_app_modules()
        _drop_database(admin_url, test_db_name)
