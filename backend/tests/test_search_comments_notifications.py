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


def _create_project(client: TestClient, headers: dict[str, str], name: str) -> int:
    response = client.post(
        "/api/projects",
        json={"name": name, "description": f"{name} description"},
        headers=headers,
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


def _add_member(
    client: TestClient,
    project_id: int,
    owner_headers: dict[str, str],
    username: str,
    role: str = "viewer",
) -> None:
    response = client.post(
        f"/api/projects/{project_id}/members",
        json={"username": username, "role": role},
        headers=owner_headers,
    )
    assert response.status_code == 201, response.text


def _upload_file(
    client: TestClient,
    project_id: int,
    headers: dict[str, str],
    filename: str,
    content: bytes,
    commit_message: str = "initial upload",
) -> dict:
    response = client.post(
        f"/api/projects/{project_id}/files",
        headers=headers,
        data={"commit_message": commit_message},
        files={"upload": (filename, content, "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def _commit_file(
    client: TestClient,
    project_id: int,
    file_id: int,
    headers: dict[str, str],
    filename: str,
    content: bytes,
    commit_message: str = "new version",
) -> dict:
    response = client.post(
        f"/api/projects/{project_id}/files/{file_id}/commit",
        headers=headers,
        data={"commit_message": commit_message},
        files={"upload": (filename, content, "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    return response.json()


def test_global_search_respects_visibility_and_admin_access(client: TestClient) -> None:
    alice_headers = _register_and_login(client, "alice", "alice@example.com")
    bob_headers = _register_and_login(client, "bob", "bob@example.com")
    admin_headers = _login(client, "superadmin", "superadmin")

    alpha_project_id = _create_project(client, alice_headers, "Alpha Gear")
    beta_project_id = _create_project(client, bob_headers, "Beta Gear")

    _upload_file(client, alpha_project_id, alice_headers, "gear-visible.step", b"alpha")
    _upload_file(client, beta_project_id, bob_headers, "gear-hidden.step", b"beta")

    alice_search = client.get("/api/search", params={"q": "gear"}, headers=alice_headers)
    assert alice_search.status_code == 200, alice_search.text
    assert [project["name"] for project in alice_search.json()["projects"]] == ["Alpha Gear"]
    assert [file["name"] for file in alice_search.json()["files"]] == ["gear-visible.step"]

    admin_search = client.get("/api/search", params={"q": "gear"}, headers=admin_headers)
    assert admin_search.status_code == 200, admin_search.text
    assert sorted(project["name"] for project in admin_search.json()["projects"]) == [
        "Alpha Gear",
        "Beta Gear",
    ]
    assert sorted(file["name"] for file in admin_search.json()["files"]) == [
        "gear-hidden.step",
        "gear-visible.step",
    ]


def test_project_search_only_returns_matching_files_in_that_project(
    client: TestClient,
) -> None:
    alice_headers = _register_and_login(client, "alice", "alice@example.com")

    project_id = _create_project(client, alice_headers, "Assembly")
    other_project_id = _create_project(client, alice_headers, "Other")

    _upload_file(client, project_id, alice_headers, "motor.step", b"motor")
    _upload_file(client, other_project_id, alice_headers, "motor-hidden.step", b"other")

    response = client.get(
        f"/api/projects/{project_id}/search",
        params={"q": "motor"},
        headers=alice_headers,
    )

    assert response.status_code == 200, response.text
    assert [file["name"] for file in response.json()] == ["motor.step"]


def test_comments_and_mentions_create_notifications_for_file_and_version_targets(
    client: TestClient,
) -> None:
    alice_headers = _register_and_login(client, "alice", "alice@example.com")
    bob_headers = _register_and_login(client, "bob", "bob@example.com")

    project_id = _create_project(client, alice_headers, "Comment Project")
    _add_member(client, project_id, alice_headers, "bob", role="viewer")

    file_payload = _upload_file(client, project_id, alice_headers, "part.step", b"v1")
    version_payload = _commit_file(
        client,
        project_id,
        file_payload["id"],
        alice_headers,
        "part.step",
        b"v2",
    )

    file_comment = client.post(
        f"/api/projects/{project_id}/files/{file_payload['id']}/comments",
        json={"content": "please review @alice @alice @ghost"},
        headers=bob_headers,
    )
    assert file_comment.status_code == 201, file_comment.text
    assert file_comment.json()["file_version_id"] is None

    list_file_comments = client.get(
        f"/api/projects/{project_id}/files/{file_payload['id']}/comments",
        headers=alice_headers,
    )
    assert list_file_comments.status_code == 200, list_file_comments.text
    assert [comment["content"] for comment in list_file_comments.json()] == [
        "please review @alice @alice @ghost"
    ]

    alice_notifications = client.get("/api/notifications", headers=alice_headers)
    assert alice_notifications.status_code == 200, alice_notifications.text
    assert len(alice_notifications.json()) == 1
    assert alice_notifications.json()[0]["comment_id"] == file_comment.json()["id"]
    assert alice_notifications.json()[0]["is_read"] is False

    version_comment = client.post(
        f"/api/projects/{project_id}/files/{file_payload['id']}/versions/{version_payload['id']}/comments",
        json={"content": "looks good @bob"},
        headers=alice_headers,
    )
    assert version_comment.status_code == 201, version_comment.text
    assert version_comment.json()["file_version_id"] == version_payload["id"]

    list_version_comments = client.get(
        f"/api/projects/{project_id}/files/{file_payload['id']}/versions/{version_payload['id']}/comments",
        headers=bob_headers,
    )
    assert list_version_comments.status_code == 200, list_version_comments.text
    assert [comment["content"] for comment in list_version_comments.json()] == [
        "looks good @bob"
    ]

    bob_notifications = client.get("/api/notifications", headers=bob_headers)
    assert bob_notifications.status_code == 200, bob_notifications.text
    assert len(bob_notifications.json()) == 1
    assert bob_notifications.json()[0]["comment_id"] == version_comment.json()["id"]
    assert bob_notifications.json()[0]["file_version_id"] == version_payload["id"]


def test_comment_delete_and_notification_read_permissions_are_enforced(
    client: TestClient,
) -> None:
    alice_headers = _register_and_login(client, "alice", "alice@example.com")
    bob_headers = _register_and_login(client, "bob", "bob@example.com")
    admin_headers = _login(client, "superadmin", "superadmin")

    project_id = _create_project(client, alice_headers, "Permission Project")
    _add_member(client, project_id, alice_headers, "bob", role="viewer")
    file_payload = _upload_file(client, project_id, alice_headers, "draft.txt", b"v1")

    file_comment = client.post(
        f"/api/projects/{project_id}/files/{file_payload['id']}/comments",
        json={"content": "for alice @alice"},
        headers=bob_headers,
    )
    assert file_comment.status_code == 201, file_comment.text

    notifications = client.get("/api/notifications", headers=alice_headers)
    assert notifications.status_code == 200, notifications.text
    notification_id = notifications.json()[0]["id"]

    other_user_mark_read = client.post(
        f"/api/notifications/{notification_id}/read",
        headers=bob_headers,
    )
    assert other_user_mark_read.status_code == 403

    owner_delete = client.delete(
        f"/api/projects/{project_id}/comments/{file_comment.json()['id']}",
        headers=alice_headers,
    )
    assert owner_delete.status_code == 403

    mark_read = client.post(
        f"/api/notifications/{notification_id}/read",
        headers=alice_headers,
    )
    assert mark_read.status_code == 200, mark_read.text
    assert mark_read.json()["is_read"] is True

    admin_delete = client.delete(
        f"/api/projects/{project_id}/comments/{file_comment.json()['id']}",
        headers=admin_headers,
    )
    assert admin_delete.status_code == 204, admin_delete.text

    remaining_comments = client.get(
        f"/api/projects/{project_id}/files/{file_payload['id']}/comments",
        headers=alice_headers,
    )
    assert remaining_comments.status_code == 200, remaining_comments.text
    assert remaining_comments.json() == []
