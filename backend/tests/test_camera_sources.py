import asyncio
from unittest.mock import AsyncMock

import pytest
from app.database.models import HouseCamera
from defusedxml import ElementTree
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy.orm import Session

from camera_worker import main as worker
from smart_city_api.core.camera_source import CameraSource, require_public_address
from smart_city_api.core.config import Settings
from smart_city_api.services import camera_media
from tests.test_api import headers
from tests.test_resident_cameras import body
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]


@pytest.mark.parametrize(
    "kind,url",
    [
        ("snapshot", "https://camera.example/image.jpg"),
        ("snapshot", "http://camera.example/image.png"),
        ("rtsp", "rtsp://camera.example:554/stream1"),
        ("rtsp", "rtsps://camera.example:322/stream1"),
        ("rtmp", "rtmp://camera.example/live/main"),
        ("rtmp", "rtmps://camera.example/live/main"),
        ("onvif", "http://camera.example:2020/onvif/device_service"),
        ("mjpeg", "http://camera.example/video.mjpeg"),
        ("hls", "https://camera.example/live.m3u8"),
        ("http_video", "https://camera.example/live.flv"),
    ],
)
def test_supported_camera_sources(kind, url):
    assert CameraSource(source_type=kind, source_url=url).source_url == url


@pytest.mark.parametrize(
    "url",
    [
        "file:///etc/passwd",
        "exec:whoami",
        "ffmpeg:virtual?video",
        "http://localhost/",
        "http://127.0.0.1/",
        "http://169.254.169.254/latest/meta-data/",
        "http://10.1.2.3/",
        "http://192.168.0.1/",
        "http://[::1]/",
        "http://[::ffff:127.0.0.1]/",
        "https://user:password@camera.example/frame.jpg",
        "https://camera.example/#exec=foo",
        "https://camera.example/a\nb",
        "https://camera.example\\@127.0.0.1/",
        "https://camera.example:0/",
    ],
)
def test_unsafe_sources_are_rejected(url):
    with pytest.raises(ValidationError):
        CameraSource(source_url=url)


def test_mixed_public_private_dns_is_rejected(monkeypatch):
    async def run():
        loop = asyncio.get_running_loop()
        monkeypatch.setattr(
            loop,
            "getaddrinfo",
            AsyncMock(
                return_value=[
                    (None, None, None, None, ("8.8.8.8", 80)),
                    (None, None, None, None, ("127.0.0.1", 80)),
                ]
            ),
        )
        with pytest.raises(ValueError, match="публичному"):
            await require_public_address("https://camera.example/")

    asyncio.run(run())


def test_private_source_encrypted_and_idempotent(api, monkeypatch, tmp_path):
    client, engine, _ = api
    monkeypatch.setattr(camera_media, "frame", AsyncMock(return_value=b"\xff\xd8frame\xff\xd9"))
    client.app.state.settings.media_root = tmp_path
    payload = body(
        source_type="rtsp",
        source_url="rtsp://camera.example/stream1",
        username="admin",
        password="camera-password",
    )
    first = client.post("/api/v1/houses/1/cameras", headers=headers(), json=payload)
    assert first.status_code == 201, first.text
    camera = first.json()
    assert camera["live_available"]
    assert "camera-password" not in first.text and "camera.example" not in first.text
    with Session(engine) as session:
        stored = session.get(HouseCamera, int(camera["id"]))
        assert stored.preview_url is None
        assert (
            "camera-password" not in stored.source_config
            and "camera.example" not in stored.source_config
        )
        assert (
            camera_media.decode(
                stored.source_config, client.app.state.settings
            ).password.get_secret_value()
            == "camera-password"
        )
    assert client.post("/api/v1/houses/1/cameras", headers=headers(), json=payload).json() == camera
    assert (
        client.post(
            "/api/v1/houses/1/cameras", headers=headers(), json={**payload, "password": "changed"}
        ).status_code
        == 409
    )
    preview = client.get(f"/api/v1/cameras/{camera['id']}/preview", headers=headers())
    assert preview.status_code == 200 and preview.json()["src"].startswith(
        "data:image/jpeg;base64,"
    )
    assert (
        client.get(f"/api/v1/cameras/{camera['id']}/live", headers=headers(102)).status_code == 404
    )
    assert client.get(f"/api/v1/cameras/{camera['id']}/live").status_code == 401


def test_failed_probe_does_not_save_camera(api, monkeypatch, tmp_path):
    client, engine, _ = api
    client.app.state.settings.media_root = tmp_path
    monkeypatch.setattr(
        camera_media, "frame", AsyncMock(side_effect=HTTPException(503, "No frame"))
    )
    response = client.post("/api/v1/houses/1/cameras", headers=headers(), json=body())
    assert response.status_code == 503
    with Session(engine) as session:
        assert session.query(HouseCamera).count() == 1


def test_worker_rejects_wrong_content_without_leaking_source(monkeypatch):
    monkeypatch.setattr(worker, "require_public_address", AsyncMock())
    monkeypatch.setattr(worker, "snapshot", AsyncMock(side_effect=ValueError("private-password")))
    with TestClient(worker.app) as client:
        response = client.post(
            "/frame", json={"source_url": "https://camera.example/", "password": "private-password"}
        )
    assert response.status_code == 503 and "private-password" not in response.text


def test_ffmpeg_has_no_shell_and_no_file_protocol():
    source = CameraSource(
        source_type="rtsp",
        source_url="rtsp://camera.example/live",
        username="a b",
        password="x@#:$",
    )
    args = worker.ffmpeg_args(source, live=True)
    assert "-rtsp_transport" in args and args[args.index("-rtsp_transport") + 1] == "tcp"
    assert "file" not in args[args.index("-protocol_whitelist") + 1].split(",")
    assert args[args.index("-i") + 1] == "rtsp://a%20b:x%40%23%3A%24@camera.example/live"
    assert "mpjpeg" in args


def test_onvif_uses_configured_public_origin_and_external_rtsp_port(monkeypatch):
    replies = [
        '<r xmlns:tt="http://www.onvif.org/ver10/schema"><tt:Media><tt:XAddr>http://192.168.1.2/media</tt:XAddr></tt:Media></r>',
        '<r xmlns:trt="http://www.onvif.org/ver10/media/wsdl"><trt:Profiles token="main"/></r>',
        '<r xmlns:tt="http://www.onvif.org/ver10/schema"><tt:Uri>rtsp://192.168.1.2/live/main</tt:Uri></r>',
    ]
    soap = AsyncMock(side_effect=[ElementTree.fromstring(reply) for reply in replies])
    monkeypatch.setattr(worker, "soap", soap)
    monkeypatch.setattr(worker, "require_public_address", AsyncMock())
    source = CameraSource(
        source_type="onvif",
        source_url="https://camera.example:8443/device",
        rtsp_port=1554,
        username="camera",
        password="secret",
    )
    target = asyncio.run(worker.onvif_stream(source))
    assert soap.await_args_list[1].args[1] == "https://camera.example:8443/media"
    assert target.source_url == "rtsp://camera.example:1554/live/main"
    assert target.password.get_secret_value() == "secret"


def test_staff_frames_are_scoped_and_never_include_private_cameras(staff_api, monkeypatch):
    client, _, _ = staff_api
    monkeypatch.setattr(camera_media, "frame", AsyncMock(return_value=b"\xff\xd8frame\xff\xd9"))
    private = client.post("/api/v1/houses/1/cameras", headers=headers(), json=body()).json()
    public = client.post(
        "/api/v1/houses/1/cameras", headers=headers(), json=body(is_public=True)
    ).json()
    login(client)
    assert client.get(ROOT + f"/cameras/{private['id']}/frame").status_code == 404
    response = client.get(ROOT + f"/cameras/{public['id']}/frame")
    assert response.status_code == 200 and response.headers["content-type"] == "image/jpeg"
    login(client, "other")
    assert client.get(ROOT + f"/cameras/{public['id']}/frame").status_code == 404


def test_missing_key_does_not_silently_create_a_replacement(tmp_path):
    settings = Settings(_env_file=None, media_root=tmp_path)
    source = CameraSource(source_url="https://camera.example/image.jpg", password="secret")
    encrypted = camera_media.encode(source, settings)
    key = tmp_path / "camera-source.key"
    key.unlink()
    with pytest.raises(HTTPException) as failure:
        camera_media.decode(encrypted, settings)
    assert failure.value.status_code == 503
    assert not key.exists()
