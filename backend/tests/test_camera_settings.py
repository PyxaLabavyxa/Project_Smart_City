from unittest.mock import AsyncMock

import pytest
from app.database.models import HouseCamera
from fastapi import HTTPException
from sqlalchemy.orm import Session

from smart_city_api.services import camera_media
from tests.test_api import headers
from tests.test_resident_cameras import body
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]
BASE = "/api/v1/cameras/"


@pytest.fixture(autouse=True)
def camera_frame(api, monkeypatch, tmp_path):
    api[0].app.state.settings.media_root = tmp_path
    monkeypatch.setattr(camera_media, "frame", AsyncMock(return_value=b"\xff\xd8frame\xff\xd9"))


def create(client, **changes):
    payload = body(
        source_type="rtsp",
        source_url="rtsp://camera.example/live",
        username="camera",
        password="private-password",
        **changes,
    )
    response = client.post("/api/v1/houses/1/cameras", headers=headers(), json=payload)
    assert response.status_code == 201, response.text
    return response.json()["id"]


def edit_payload(settings, **changes):
    return {
        key: settings[key]
        for key in (
            "name",
            "note",
            "source_type",
            "source_url",
            "username",
            "auth_type",
            "profile",
            "rtsp_port",
            "is_public",
        )
    } | {"expected_version": settings["version"], "keep_password": True, **changes}


def test_settings_and_deletion_are_owner_only_and_do_not_return_password(api):
    client, _, _ = api
    camera = create(client)
    path = BASE + camera + "/settings"
    settings = client.get(path, headers=headers()).json()
    assert settings["source_url"] == "rtsp://camera.example/live"
    assert settings["password_set"] and "password" not in settings
    assert "private-password" not in str(settings)
    for user in (102, 103, 104):
        assert client.get(path, headers=headers(user)).status_code == 404
        assert (
            client.post(path, headers=headers(user), json=edit_payload(settings)).status_code == 404
        )
        assert client.delete(BASE + camera, headers=headers(user)).status_code == 404
    assert client.get(path).status_code == 401
    assert client.delete(BASE + camera, headers=headers()).status_code == 204
    assert client.get(path, headers=headers()).status_code == 404
    assert client.get(BASE + camera + "/preview", headers=headers()).status_code == 404


def test_edit_preserves_location_and_password_and_rejects_stale_writes(api):
    client, _, _ = api
    camera = create(client)
    path = BASE + camera + "/settings"
    settings = client.get(path, headers=headers()).json()
    payload = edit_payload(settings, name="Обновлённая камера")
    result = client.post(path, headers=headers(), json=payload)
    assert result.status_code == 200
    assert result.json()["place"]["entrance"] == 1
    assert client.get(path, headers=headers()).json()["password_set"]
    assert client.post(path, headers=headers(), json=payload).status_code == 200
    stale = client.post(path, headers=headers(), json=edit_payload(settings, name="Старое окно"))
    assert stale.status_code == 409
    assert (
        client.post(
            path, headers=headers(), json={**payload, "place": {"zone": "courtyard"}}
        ).status_code
        == 422
    )


def test_changed_source_is_checked_before_save_and_password_can_be_cleared(api, monkeypatch):
    client, _, _ = api
    camera = create(client)
    path = BASE + camera + "/settings"
    settings = client.get(path, headers=headers()).json()
    probe = AsyncMock(side_effect=HTTPException(503, "No frame"))
    monkeypatch.setattr(camera_media, "frame", probe)
    assert (
        client.post(
            path,
            headers=headers(),
            json=edit_payload(settings, source_url="rtsp://camera.example/changed"),
        ).status_code
        == 503
    )
    assert client.get(path, headers=headers()).json()["version"] == settings["version"]
    probe.side_effect = None
    probe.return_value = b"\xff\xd8frame\xff\xd9"
    assert (
        client.post(
            path, headers=headers(), json=edit_payload(settings, password="", keep_password=False)
        ).status_code
        == 200
    )
    assert not client.get(path, headers=headers()).json()["password_set"]


def test_public_edit_requires_moderation_again_but_unchanged_retry_does_not(staff_api):
    client, _, _ = staff_api
    camera = create(client, is_public=True)
    csrf = login(client)
    assert (
        client.post(
            ROOT + f"/cameras/{camera}/moderate", headers=csrf, json={"decision": "approved"}
        ).status_code
        == 200
    )
    path = BASE + camera + "/settings"
    settings = client.get(path, headers=headers()).json()
    assert (
        client.post(path, headers=headers(), json=edit_payload(settings)).json()[
            "moderation_status"
        ]
        == "approved"
    )
    response = client.post(
        path, headers=headers(), json=edit_payload(settings, note="Другой ракурс")
    )
    assert response.status_code == 200 and response.json()["moderation_status"] == "pending"
    assert client.get(BASE + camera + "/preview", headers=headers(102)).status_code == 404
    assert client.get(path, headers=headers(102)).status_code == 404


@pytest.mark.parametrize("demo", [False, True])
def test_metadata_and_access_can_change_without_a_frame(api, monkeypatch, demo):
    client, engine, _ = api
    camera = create(client, is_public=True)
    if demo:
        with Session(engine) as session:
            row = session.get(HouseCamera, int(camera))
            row.source_config = None
            row.preview_url = "/images/cameras/demo.jpg"
            session.commit()
    path = BASE + camera + "/settings"
    settings = client.get(path, headers=headers()).json()
    frame = AsyncMock(side_effect=HTTPException(503, "Offline"))
    monkeypatch.setattr(camera_media, "frame", frame)
    payload = {
        "name": "New name",
        "note": "New note",
        "is_public": False,
        "expected_version": settings["version"],
    }
    assert client.post(path, headers=headers(102), json=payload).status_code == 404
    response = client.post(path, headers=headers(), json=payload)
    assert response.status_code == 200, response.text
    assert response.json()["visibility"] == "private"
    assert response.json()["name"] == "New name"
    frame.assert_not_awaited()
    updated = client.get(path, headers=headers()).json()
    assert updated["source_url"] == settings["source_url"]
    assert updated["password_set"] == settings["password_set"]
    assert client.post(path, headers=headers(), json=payload).status_code == 200
    assert (
        client.post(path, headers=headers(), json={**payload, "note": "Stale"}).status_code == 409
    )
    # Incomplete/unsafe connections cannot fall through to the metadata-only variant.
    for connection in ({"source_url": "http://127.0.0.1/private"}, {"username": "changed"}):
        result = client.post(path, headers=headers(), json={**payload, **connection})
        assert result.status_code == 422
    if demo:
        with Session(engine) as session:
            row = session.get(HouseCamera, int(camera))
            assert row.source_config is None and row.preview_url == "/images/cameras/demo.jpg"
