import asyncio
from unittest.mock import AsyncMock

import httpx
import pytest
from app.database.models import HouseCamera
from fastapi import HTTPException
from sqlalchemy.orm import Session

from camera_worker import main as worker
from smart_city_api.core.camera_source import CameraSource
from smart_city_api.services import camera_media
from tests.test_api import headers
from tests.test_resident_cameras import body
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]


@pytest.mark.parametrize(
    "url,kind",
    [
        ("rtsp://camera.example/live", "rtsp"),
        ("rtsps://camera.example/live", "rtsp"),
        ("rtmp://camera.example/live", "rtmp"),
        ("https://camera.example/LIVE.M3U8?signature=unchanged", "hls"),
        ("https://camera.example/onvif/device_service", "onvif"),
        ("https://camera.example/stream.mjpeg", "mjpeg"),
        ("https://camera.example/frame.png", "snapshot"),
        ("https://camera.example/live.flv", "http_video"),
        ("https://camera.example/opaque", "auto"),
    ],
)
def test_auto_detection_preserves_signed_url(url, kind):
    source = CameraSource(source_type="auto", source_url=url)
    assert source.source_type == kind
    assert source.source_url == url


@pytest.mark.parametrize(
    "content_type,content,kind",
    [
        ("image/jpeg", b"jpeg", "snapshot"),
        ("multipart/x-mixed-replace; boundary=frame", b"", "mjpeg"),
        ("application/vnd.apple.mpegurl", b"#EXTM3U", "hls"),
        ("video/mp4", b"video", "http_video"),
        ("application/octet-stream", b"\xff\xd8frame", "snapshot"),
        ("application/octet-stream", b"#EXTM3U\n", "hls"),
    ],
)
def test_worker_detects_extensionless_http_sources(monkeypatch, content_type, content, kind):
    original = httpx.AsyncClient
    transport = httpx.MockTransport(
        lambda request: httpx.Response(200, headers={"Content-Type": content_type}, content=content)
    )
    monkeypatch.setattr(
        worker.httpx, "AsyncClient", lambda **kwargs: original(transport=transport, **kwargs)
    )
    monkeypatch.setattr(worker, "require_public_address", AsyncMock())
    source = CameraSource(source_type="auto", source_url="https://camera.example/opaque")
    assert asyncio.run(worker.prepare(source)).source_type == kind


def test_resident_probe_does_not_save_and_requires_house_access(api, monkeypatch):
    client, engine, _ = api
    frame = AsyncMock(return_value=b"\xff\xd8frame\xff\xd9")
    monkeypatch.setattr(camera_media, "frame", frame)
    data = {"source_url": "rtsp://camera.example/live", "password": "private-secret"}
    path = "/api/v1/houses/1/cameras/probe"
    assert client.post(path, json=data).status_code == 401
    assert (
        client.post("/api/v1/houses/2/cameras/probe", headers=headers(), json=data).status_code
        == 404
    )
    response = client.post(path, headers=headers(), json=data)
    assert response.status_code == 200
    assert response.json()["source_type"] == "rtsp"
    assert response.json()["src"].startswith("data:image/jpeg;base64,")
    assert "private-secret" not in response.text and "camera.example" not in response.text
    with Session(engine) as s:
        assert s.query(HouseCamera).count() == 1
    assert frame.await_count == 1


def test_staff_creation_is_scoped_public_and_idempotent(staff_api, monkeypatch):
    client, engine, _ = staff_api
    monkeypatch.setattr(camera_media, "frame", AsyncMock(return_value=b"\xff\xd8frame\xff\xd9"))
    data = body(house_id=1, is_public=True, source_type="snapshot")
    assert client.post(ROOT + "/cameras", json=data).status_code == 401
    csrf = login(client)
    assert client.post(ROOT + "/cameras", json=data).status_code == 403
    assert (
        client.post(ROOT + "/cameras", headers=csrf, json={**data, "house_id": 2}).status_code
        == 404
    )
    response = client.post(ROOT + "/cameras", headers=csrf, json=data)
    assert response.status_code == 201, response.text
    camera = response.json()
    assert camera["visibility"] == "public" and camera["moderation_status"] == "approved"
    assert client.post(ROOT + "/cameras", headers=csrf, json=data).json() == camera
    assert (
        client.post(ROOT + "/cameras", headers=csrf, json={**data, "name": "Changed"}).status_code
        == 409
    )
    assert any(
        row["id"] == camera["id"]
        for row in client.get("/api/v1/houses/1/cameras", headers=headers()).json()
    )
    with Session(engine) as s:
        stored = s.get(HouseCamera, int(camera["id"]))
        assert stored.owner_id is None and stored.created_by_staff_id == 1
        assert stored.source_type == "snapshot"
    assert client.get(ROOT + f"/cameras/{camera['id']}/frame").status_code == 200
    other_csrf = login(client, "other")
    assert client.get(ROOT + f"/cameras/{camera['id']}/frame").status_code == 404
    assert client.delete(ROOT + f"/cameras/{camera['id']}", headers=other_csrf).status_code == 404


def test_staff_probe_failures_and_places_do_not_create_records(staff_api, monkeypatch):
    client, engine, _ = staff_api
    csrf = login(client)
    frame = AsyncMock(side_effect=HTTPException(503, "Камера недоступна"))
    monkeypatch.setattr(camera_media, "frame", frame)
    data = {"house_id": 1, "source_url": "https://camera.example/opaque"}
    assert (
        client.post(ROOT + "/cameras/probe", headers=csrf, json={**data, "house_id": 2}).status_code
        == 404
    )
    assert frame.await_count == 0
    assert client.post(ROOT + "/cameras/probe", headers=csrf, json=data).status_code == 503
    assert (
        client.post(
            ROOT + "/cameras", headers=csrf, json=body(house_id=1, is_public=True)
        ).status_code
        == 503
    )
    assert (
        client.post(
            ROOT + "/cameras",
            headers=csrf,
            json=body(
                house_id=1,
                is_public=True,
                place={"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1},
            ),
        ).status_code
        == 422
    )
    with Session(engine) as s:
        assert s.query(HouseCamera).count() == 1


def test_settings_probe_keeps_password_only_for_the_owner(api, monkeypatch, tmp_path):
    client, _, _ = api
    client.app.state.settings.media_root = tmp_path
    frame = AsyncMock(return_value=b"\xff\xd8frame\xff\xd9")
    monkeypatch.setattr(camera_media, "frame", frame)
    camera = client.post(
        "/api/v1/houses/1/cameras", headers=headers(), json=body(password="private-password")
    ).json()
    payload = {
        "camera_id": int(camera["id"]),
        "keep_password": True,
        "source_url": "https://camera.example/frame.jpg",
    }
    path = "/api/v1/houses/1/cameras/probe"
    response = client.post(path, headers=headers(), json=payload)
    assert response.status_code == 200
    assert "private-password" not in response.text
    assert frame.await_args.args[0].password.get_secret_value() == "private-password"
    count = frame.await_count
    assert client.post(path, headers=headers(102), json=payload).status_code == 404
    assert frame.await_count == count
