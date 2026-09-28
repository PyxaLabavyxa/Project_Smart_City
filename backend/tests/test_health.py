import sqlite3

from fastapi.testclient import TestClient
from pydantic import SecretStr

from smart_city_api.core.config import Settings
from smart_city_api.main import create_app


def test_liveness_does_not_require_database():
    settings = Settings(_env_file=None, database_url=None)
    with TestClient(create_app(settings)) as client:
        assert client.get("/health/live").json() == {"status": "ok"}
        assert client.get("/health/ready").status_code == 503
        paths = client.get("/openapi.json").json()["paths"]
        assert {"/health/live", "/health/ready", "/api/v1/me"} <= set(paths)


def test_readiness_uses_sqlalchemy_without_creating_domain_tables(tmp_path):
    path = tmp_path / "isolated.db"
    settings = Settings(_env_file=None, database_url=SecretStr(f"sqlite+aiosqlite:///{path}"))
    with TestClient(create_app(settings)) as client:
        response = client.get("/health/ready")
        assert response.status_code == 200
        assert response.json() == {"status": "ok"}
    with sqlite3.connect(path) as connection:
        assert (
            connection.execute("SELECT name FROM sqlite_master WHERE type='table'").fetchall() == []
        )


def test_database_failure_does_not_expose_connection_details(tmp_path):
    path = tmp_path / "missing-directory" / "private.db"
    settings = Settings(_env_file=None, database_url=SecretStr(f"sqlite+aiosqlite:///{path}"))
    with TestClient(create_app(settings)) as client:
        response = client.get("/health/ready")
        assert response.status_code == 503
        assert response.json() == {"detail": "Database is unavailable"}
        assert client.get("/health/live").status_code == 200


def test_cors_only_allows_configured_frontend():
    with TestClient(create_app(Settings(_env_file=None, database_url=None))) as client:
        allowed = client.options(
            "/health/live",
            headers={
                "Origin": "http://localhost:3000",
                "Access-Control-Request-Method": "GET",
            },
        )
        denied = client.options(
            "/health/live",
            headers={
                "Origin": "https://untrusted.invalid",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert allowed.headers["access-control-allow-origin"] == "http://localhost:3000"
        assert "access-control-allow-origin" not in denied.headers
