from app.database.models import User
from fastapi import Request
from fastapi.testclient import TestClient
from pydantic import SecretStr
from sqlalchemy.orm import Session

from smart_city_api.core.config import Settings
from smart_city_api.core.local_login import LOCAL_COOKIE, local_login_allowed
from smart_city_api.runtime import loop_factory

pytest_plugins = ["tests.test_api"]


def test_docker_network_must_be_explicitly_allowed():
    from types import SimpleNamespace

    settings = Settings(
        _env_file=None, local_login_enabled=True, local_session_secret=SecretStr("key")
    )
    scope = {
        "type": "http",
        "scheme": "http",
        "path": "/",
        "headers": [(b"host", b"localhost:8000")],
        "client": ("172.28.74.1", 30000),
        "app": SimpleNamespace(state=SimpleNamespace(settings=settings)),
    }
    request = Request(scope)
    assert not local_login_allowed(request)
    configured = Settings(
        _env_file=None,
        local_login_enabled=True,
        local_session_secret=SecretStr("key"),
        local_login_networks=["172.28.74.0/24"],
    )
    request.app.state.settings = configured
    assert local_login_allowed(request)
    scope["headers"] = [(b"host", b"public.example")]
    assert not local_login_allowed(Request(scope))


def test_local_login_is_explicit_scoped_and_revocable(api):
    original, engine, _ = api
    settings = original.app.state.settings
    with Session(engine) as db, db.begin():
        db.add(User(max_user_id=-1, name="Local resident"))
    with TestClient(
        original.app,
        base_url="http://localhost",
        client=("127.0.0.1", 1234),
        backend_options={"loop_factory": loop_factory},
    ) as client:
        origin = {"Origin": "http://localhost:3000"}
        assert client.post("/api/v1/auth/local", headers=origin).status_code == 404
        settings.local_login_enabled = True
        settings.local_session_secret = SecretStr("test-local-key")
        assert client.post("/api/v1/auth/local").status_code == 403
        assert client.post("/api/v1/auth/local", headers=origin).status_code == 204
        assert client.get("/api/v1/me").status_code == 200
        assert client.post("/api/v1/auth/logout").status_code == 403
        settings.local_login_enabled = False
        assert client.get("/api/v1/me").status_code == 401
        settings.local_login_enabled = True
        client.cookies.set(LOCAL_COOKIE, "invalid", domain="localhost.local", path="/api/v1")
        assert client.get("/api/v1/me").status_code == 401
        assert client.post("/api/v1/auth/logout", headers=origin).status_code == 204
        assert client.get("/api/v1/me").status_code == 401


def test_local_login_rejects_remote_clients(api):
    original, _, _ = api
    original.app.state.settings.local_login_enabled = True
    original.app.state.settings.local_session_secret = SecretStr("test-local-key")
    with TestClient(
        original.app,
        base_url="http://localhost",
        client=("192.0.2.1", 1234),
        backend_options={"loop_factory": loop_factory},
    ) as client:
        assert (
            client.post(
                "/api/v1/auth/local", headers={"Origin": "http://localhost:3000"}
            ).status_code
            == 404
        )
