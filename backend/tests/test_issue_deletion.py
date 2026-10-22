import importlib.util
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from app.database.enums import IssueStatus
from app.database.models import Issue, IssueEvent, StaffNotification, UserApartment
from alembic.migration import MigrationContext
from alembic.operations import Operations
from sqlalchemy import create_engine, delete, inspect, select, text
from sqlalchemy.orm import Session

from tests.test_api import headers, issue_body
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]


def test_author_can_delete_new_issue_but_no_one_can_access_it_afterwards(staff_api):
    client, engine, _ = staff_api
    path = "/api/v1/issues/1"
    csrf = login(client)
    message = client.post(path + "/messages", headers=headers(), json={"text": "Details", "request_id": str(uuid4())})
    assert message.status_code == 200, message.text
    reply = client.post(ROOT + "/issues/1/messages", headers=csrf, json={"text": "Reply", "request_id": str(uuid4())})
    assert reply.status_code == 200, reply.text
    staff_photo = client.get(ROOT + "/issues/1").json()["photos"][0]["url"]
    assert client.delete(path).status_code == 401
    assert client.delete(path, headers=headers(102)).status_code == 404
    assert client.delete(path, headers=headers(103)).status_code == 404
    assert client.delete(path, headers=headers()).status_code == 204
    assert client.delete(path, headers=headers()).status_code == 204
    for suffix in ("", "/messages", "/photos/1"):
        assert client.get(path + suffix, headers=headers()).status_code == 404
    assert client.get(ROOT + "/issues/1").status_code == 404
    assert client.get(staff_photo).status_code == 404
    assert client.post(path + "/messages", headers=headers(), json={"text": "Again", "request_id": str(uuid4())}).status_code == 404
    assert 1 not in {row["id"] for row in client.get("/api/v1/houses/1/issues", headers=headers()).json()["items"]}
    staff_list = client.get(ROOT + "/issues").json()
    assert 1 not in {row["id"] for row in staff_list["items"]}
    assert staff_list["counts"]["new"] == 0
    assert client.post(ROOT + "/issues/1/status", headers=csrf, json={"status": "in_progress", "expected_status": "new", "request_id": str(uuid4())}).status_code == 404
    with Session(engine) as session:
        assert session.get(Issue, 1).deleted_at is not None
        assert all(row.suppressed_at is not None for row in session.scalars(select(StaffNotification).where(StaffNotification.issue_id == 1)))


@pytest.mark.parametrize("status", [IssueStatus.IN_PROGRESS, IssueStatus.RESOLVED])
def test_accepted_or_completed_issue_cannot_be_deleted(staff_api, status):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.get(Issue, 1).status = status
        session.commit()
    assert client.delete("/api/v1/issues/1", headers=headers()).status_code == 409
    assert client.get("/api/v1/issues/1", headers=headers()).status_code == 200


def test_issue_returned_to_new_is_still_not_deletable(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.add(IssueEvent(issue_id=1, status="in_progress"))
        session.commit()
    assert client.delete("/api/v1/issues/1", headers=headers()).status_code == 409


def test_delete_requires_current_house_access(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.execute(delete(UserApartment).where(UserApartment.user_id == 1))
        session.commit()
    assert client.delete("/api/v1/issues/1", headers=headers()).status_code == 404
    with Session(engine) as session:
        assert session.get(Issue, 1).deleted_at is None


def test_retry_of_creation_does_not_restore_deleted_issue(staff_api):
    client, engine, _ = staff_api
    body = issue_body()
    path = "/api/v1/houses/1/issues"
    created = client.post(path, headers=headers(), json=body)
    assert created.status_code == 201, created.text
    issue_id = created.json()["id"]
    assert client.delete(f"/api/v1/issues/{issue_id}", headers=headers()).status_code == 204
    assert client.post(path, headers=headers(), json=body).status_code == 409
    with Session(engine) as session:
        assert session.get(Issue, issue_id).deleted_at is not None


def test_acceptance_and_deletion_cannot_both_succeed(staff_api):
    client, engine, _ = staff_api
    if engine.dialect.name != "postgresql":
        pytest.skip("Row lock concurrency is verified on PostgreSQL")
    csrf = login(client)
    barrier = Barrier(2)

    def accept():
        barrier.wait(timeout=10)
        return client.post(ROOT + "/issues/1/status", headers=csrf, json={"status": "in_progress", "expected_status": "new", "request_id": str(uuid4())}).status_code

    def remove():
        barrier.wait(timeout=10)
        return client.delete("/api/v1/issues/1", headers=headers()).status_code

    with ThreadPoolExecutor(max_workers=2) as pool:
        accepted = pool.submit(accept)
        deleted = pool.submit(remove)
        statuses = (accepted.result(timeout=20), deleted.result(timeout=20))
    assert statuses in ((200, 409), (404, 204))
    with Session(engine) as session:
        issue = session.get(Issue, 1)
        assert (issue.status, issue.deleted_at is not None) in (
            (IssueStatus.IN_PROGRESS, False), (IssueStatus.NEW, True),
        )


def test_deletion_migration_never_resurrects_tombstones_on_downgrade(tmp_path):
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0019_resident_issue_deletion.py"
    spec = importlib.util.spec_from_file_location("issue_deletion", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine(f"sqlite:///{tmp_path / 'deletion.db'}")
    try:
        with engine.begin() as connection, Operations.context(MigrationContext.configure(connection)):
            connection.execute(text("CREATE TABLE issues (id INTEGER PRIMARY KEY, title TEXT)"))
            connection.execute(text("INSERT INTO issues VALUES (1, 'Existing issue')"))
            migration.upgrade()
            assert connection.scalar(text("SELECT deleted_at FROM issues")) is None
            connection.execute(text("UPDATE issues SET deleted_at = CURRENT_TIMESTAMP"))
            with pytest.raises(RuntimeError, match="visible again"):
                migration.downgrade()
            assert connection.scalar(text("SELECT deleted_at FROM issues")) is not None
            connection.execute(text("DELETE FROM issues"))
            migration.downgrade()
            assert "deleted_at" not in {column["name"] for column in inspect(connection).get_columns("issues")}
    finally:
        engine.dispose()
