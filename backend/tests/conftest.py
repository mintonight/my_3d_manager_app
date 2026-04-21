import importlib
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _clear_app_modules() -> None:
    for name in list(sys.modules):
        if name == "app" or name.startswith("app."):
            del sys.modules[name]


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> TestClient:
    db_path = tmp_path / "test.db"
    blob_dir = tmp_path / "blobs"

    monkeypatch.setenv("ZGG_DATABASE_URL", f"sqlite:///{db_path.as_posix()}")
    monkeypatch.setenv("ZGG_ADMIN_USERNAME", "superadmin")
    monkeypatch.setenv("ZGG_ADMIN_EMAIL", "superadmin@example.com")
    monkeypatch.setenv("ZGG_ADMIN_PASSWORD", "superadmin")

    _clear_app_modules()
    main = importlib.import_module("app.main")
    storage = importlib.import_module("app.storage")
    config = importlib.import_module("app.config")

    blob_dir.mkdir(parents=True, exist_ok=True)
    storage.BLOB_DIR = blob_dir
    config.BLOB_DIR = blob_dir

    with TestClient(main.app) as test_client:
        yield test_client

    _clear_app_modules()
