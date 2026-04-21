import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.mark.skipif(os.name != "nt", reason="eDrawings launch is Windows-only")
def test_edrawings_open_launches_local_viewer_with_cached_file(
    client: TestClient,
    monkeypatch,
    tmp_path: Path,
) -> None:
    import app.routers.files as files_router

    exe_path = tmp_path / "eDrawings.exe"
    exe_path.write_bytes(b"fake exe")
    cache_dir = tmp_path / "edrawings-cache"

    monkeypatch.setattr(files_router.settings, "edrawings_exe_path", exe_path)
    monkeypatch.setattr(files_router.settings, "edrawings_cache_dir", cache_dir)

    launched: dict[str, object] = {}

    def fake_popen(args, cwd=None, close_fds=None, creationflags=0):
        launched["args"] = args
        launched["cwd"] = cwd
        launched["close_fds"] = close_fds
        launched["creationflags"] = creationflags

        class DummyProcess:
            returncode = None

        return DummyProcess()

    monkeypatch.setattr(files_router.subprocess, "Popen", fake_popen)

    headers = _login(client, "superadmin", "superadmin")

    project = client.post(
        "/api/projects",
        json={"name": "SolidWorks", "description": "preview"},
        headers=headers,
    )
    assert project.status_code == 201, project.text
    project_id = project.json()["id"]

    upload = client.post(
        f"/api/projects/{project_id}/files",
        headers=headers,
        data={"commit_message": "initial upload"},
        files={"upload": ("sample.sldprt", b"solidworks bytes", "application/octet-stream")},
    )
    assert upload.status_code == 201, upload.text
    payload = upload.json()

    response = client.post(
        f"/api/projects/{project_id}/files/{payload['id']}/versions/{payload['current_version_id']}/edrawings-open",
        headers=headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["status"] == "launched"

    args = launched["args"]
    assert isinstance(args, list)
    assert args[0] == str(exe_path)

    opened_path = Path(args[1])
    assert opened_path.exists()
    assert opened_path.read_bytes() == b"solidworks bytes"
    assert opened_path.parent == cache_dir / f"project-{project_id}" / f"file-{payload['id']}"
    assert opened_path.name.endswith("sample.sldprt")
