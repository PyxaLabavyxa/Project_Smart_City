import importlib.util
from pathlib import Path

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, inspect, text

from tests.test_api import headers

pytest_plugins = ["tests.test_api"]


def test_onboarding_is_persisted_per_authenticated_user_and_cannot_downgrade(api):
    client, _, _ = api
    path = "/api/v1/me/onboarding"
    assert client.post(path, json={"status": "completed"}).status_code == 401
    assert client.get("/api/v1/me", headers=headers()).json()["onboarding_status"] == "not_started"
    assert client.post(path, headers=headers(), json={"status": "skipped"}).json() == {
        "status": "skipped"
    }
    # Another device/session reads the same database flag, without localStorage.
    client.cookies.clear()
    assert client.get("/api/v1/me", headers=headers()).json()["onboarding_status"] == "skipped"
    assert (
        client.get("/api/v1/me", headers=headers(102)).json()["onboarding_status"] == "not_started"
    )
    assert client.post(path, headers=headers(), json={"status": "completed"}).status_code == 200
    assert client.post(path, headers=headers(), json={"status": "skipped"}).json() == {
        "status": "completed"
    }
    assert client.get("/api/v1/me", headers=headers()).json()["onboarding_status"] == "completed"


@pytest.mark.parametrize(
    "body",
    [
        {"status": "not_started"},
        {"status": "unknown"},
        {"status": "completed", "user_id": 2},
        {},
    ],
)
def test_onboarding_rejects_spoofed_users_and_invalid_states(api, body):
    client, _, _ = api
    assert client.post("/api/v1/me/onboarding", headers=headers(), json=body).status_code == 422
    assert client.get("/api/v1/me", headers=headers()).json()["onboarding_status"] == "not_started"


def test_onboarding_migration_preserves_users_and_rolls_back(tmp_path):
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0021_onboarding_status.py"
    spec = importlib.util.spec_from_file_location("onboarding_migration", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine(f"sqlite:///{tmp_path / 'migration.db'}")
    with engine.begin() as connection:
        connection.execute(text("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)"))
        connection.execute(text("INSERT INTO users VALUES (1, 'Existing resident')"))
        with Operations.context(MigrationContext.configure(connection)):
            migration.upgrade()
            assert connection.scalar(text("SELECT onboarding_status FROM users")) == "not_started"
            connection.execute(text("UPDATE users SET onboarding_status='completed' WHERE id=1"))
            migration.downgrade()
            assert connection.scalar(text("SELECT name FROM users")) == "Existing resident"
            assert "onboarding_status" not in {
                c["name"] for c in inspect(connection).get_columns("users")
            }
            migration.upgrade()
            assert connection.scalar(text("SELECT name FROM users")) == "Existing resident"
    engine.dispose()
