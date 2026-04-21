from fastapi.testclient import TestClient


def _login(client: TestClient, username: str, password: str) -> dict[str, str]:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200, response.text
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


def _register_and_login(
    client: TestClient,
    username: str,
    email: str,
    password: str = "secret123",
) -> dict[str, str]:
    response = client.post(
        "/api/auth/register",
        json={"username": username, "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    return _login(client, username, password)


def test_startup_creates_default_superadmin(client: TestClient) -> None:
    headers = _login(client, "superadmin", "superadmin")

    response = client.get("/api/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json() == {
        "id": 1,
        "username": "superadmin",
        "email": "superadmin@example.com",
        "is_admin": True,
        "ui_language": "zh-CN",
        "ui_theme": "light",
        "edrawings_exe_path": None,
        "created_at": response.json()["created_at"],
    }


def test_superadmin_can_access_and_modify_other_users_projects_and_files(
    client: TestClient,
) -> None:
    alice_headers = _register_and_login(client, "alice", "alice@example.com")
    bob_headers = _register_and_login(client, "bob", "bob@example.com")

    create_project = client.post(
        "/api/projects",
        json={"name": "Alice Project", "description": "owned by alice"},
        headers=alice_headers,
    )
    assert create_project.status_code == 201, create_project.text
    project_id = create_project.json()["id"]

    bob_access = client.get(f"/api/projects/{project_id}", headers=bob_headers)
    assert bob_access.status_code == 403

    admin_headers = _login(client, "superadmin", "superadmin")

    project_list = client.get("/api/projects", headers=admin_headers)
    assert project_list.status_code == 200, project_list.text
    assert [project["name"] for project in project_list.json()] == ["Alice Project"]

    project_detail = client.get(f"/api/projects/{project_id}", headers=admin_headers)
    assert project_detail.status_code == 200, project_detail.text

    upload = client.post(
        f"/api/projects/{project_id}/files",
        headers=admin_headers,
        data={"commit_message": "admin upload"},
        files={"upload": ("admin-note.txt", b"admin v1", "text/plain")},
    )
    assert upload.status_code == 201, upload.text
    file_id = upload.json()["id"]

    files = client.get(f"/api/projects/{project_id}/files", headers=admin_headers)
    assert files.status_code == 200, files.text
    assert files.json()[0]["id"] == file_id

    delete_project = client.delete(f"/api/projects/{project_id}", headers=admin_headers)
    assert delete_project.status_code == 204, delete_project.text


def test_user_can_update_persistent_ui_settings(client: TestClient) -> None:
    user_headers = _register_and_login(client, "alice", "alice@example.com")

    response = client.patch(
        "/api/auth/me/settings",
        json={
            "ui_language": "en-US",
            "ui_theme": "dark",
            "edrawings_exe_path": r"D:\Apps\eDrawings\eDrawings.exe",
        },
        headers=user_headers,
    )

    assert response.status_code == 200, response.text
    assert response.json()["ui_language"] == "en-US"
    assert response.json()["ui_theme"] == "dark"
    assert response.json()["edrawings_exe_path"] == r"D:\Apps\eDrawings\eDrawings.exe"

    me = client.get("/api/auth/me", headers=user_headers)
    assert me.status_code == 200, me.text
    assert me.json()["ui_language"] == "en-US"
    assert me.json()["ui_theme"] == "dark"
    assert me.json()["edrawings_exe_path"] == r"D:\Apps\eDrawings\eDrawings.exe"
