import importlib.util
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
from uuid import uuid4

import pytest
from alembic.migration import MigrationContext
from alembic.operations import Operations
from app.database.enums import IssueCategory, IssuePriority
from app.database.models import Issue, IssueEvent, StaffNotification, User
from sqlalchemy import create_engine, func, inspect, select, text
from sqlalchemy.orm import Session

from tests.test_api import headers
from tests.test_staff import ROOT, login, status_body

pytest_plugins = ["tests.test_staff"]


def report(**changes):
    return {
        "house_id": 1,
        "resident_id": 1,
        "request_id": str(uuid4()),
        "title": "Лампа у входа",
        "description": "Не горит второй день",
        "category": "electricity",
        "place": {"zone": "corridor", "entrance": 1, "floor": 1},
        **changes,
    }


def manual(**changes):
    return report(
        resident_id=None,
        reporter_name="Ирина Тестовая",
        reporter_phone="+7 (000) 555-10-21",
        **changes,
    )


def test_staff_pagination_defaults_to_ten_with_no_duplicates_between_pages(staff_api):
    client, engine, _ = staff_api
    with Session(engine) as session:
        session.add_all(
            Issue(
                user_id=1,
                house_id=1,
                title=f"Report {n}",
                description="Details",
                category=IssueCategory.OTHER,
                priority=IssuePriority.MEDIUM,
            )
            for n in range(15)
        )
        session.commit()
    login(client)
    first = client.get(ROOT + "/issues").json()
    second = client.get(ROOT + "/issues?page=2").json()
    assert first["page_size"] == second["page_size"] == 10
    assert first["total"] == second["total"] == 17
    assert len(first["items"]) == 10 and len(second["items"]) == 7
    assert not {r["id"] for r in first["items"]} & {r["id"] for r in second["items"]}


def test_registered_report_is_in_residents_app_and_retries_do_not_duplicate(staff_api):
    client, engine, _ = staff_api
    csrf = login(client)
    body = report(reporter_apartment_id=1, reporter_phone="12345")
    created = client.post(ROOT + "/issues", headers=csrf, json=body)
    assert created.status_code == 201, created.text
    result = created.json()
    assert result["resident_id"] == 1 and result["author"] == "Первый"
    assert result["created_by"] == "Анна Соколова" and result["reporter_phone"] == "12345"
    path = f"/api/v1/issues/{result['id']}"
    resident = client.get(path, headers=headers()).json()
    assert resident["mine"] is True
    assert all(
        field not in resident for field in ("reporter_phone", "reporter_name", "resident_id")
    )
    assert client.post(ROOT + "/issues", headers=csrf, json=body).json()["id"] == result["id"]
    assert (
        client.post(ROOT + "/issues", headers=csrf, json={**body, "title": "Different"}).status_code
        == 409
    )
    with Session(engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(IssueEvent)
                .where(IssueEvent.issue_id == result["id"])
            )
            == 1
        )
    action = client.post(ROOT + f"/issues/{result['id']}/status", headers=csrf, json=status_body())
    assert action.status_code == 200
    with Session(engine) as session:
        notice = session.get(StaffNotification, action.json()["notification_id"])
        assert notice.max_user_id == 101 and notice.suppressed_at is None


def test_manual_report_preserves_caller_and_status_notes_without_phantom_accounts(staff_api):
    client, engine, _ = staff_api
    csrf = login(client)
    with Session(engine) as session:
        original_count = session.scalar(select(func.count()).select_from(User))
    body = manual(reporter_apartment_id=1)
    saved = client.post(ROOT + "/issues", headers=csrf, json=body)
    assert saved.status_code == 201, saved.text
    row = saved.json()
    issue_id = row["id"]
    assert row["author"] == body["reporter_name"] and row["resident_id"] is None
    assert row["reporter_phone"] == body["reporter_phone"] and row["reporter_apartment"] == 7
    assert issue_id in {r["id"] for r in client.get(ROOT + "/issues").json()["items"]}
    assert client.post(ROOT + "/issues", headers=csrf, json=body).json()["id"] == issue_id
    action_body = status_body()
    action = client.post(ROOT + f"/issues/{issue_id}/status", headers=csrf, json=action_body)
    assert action.status_code == 200, action.text
    assert (
        client.post(ROOT + f"/issues/{issue_id}/status", headers=csrf, json=action_body).json()
        == action.json()
    )
    message_body = {"text": "Позвонили заявителю", "request_id": str(uuid4())}
    assert (
        client.post(
            ROOT + f"/issues/{issue_id}/messages", headers=csrf, json=message_body
        ).status_code
        == 200
    )
    assert (
        client.post(
            ROOT + f"/issues/{issue_id}/messages", headers=csrf, json=message_body
        ).status_code
        == 200
    )
    detail = client.get(ROOT + f"/issues/{issue_id}").json()
    assert len(detail["messages"]) == 1
    assert all(n["delivery"] == "not_required" for n in detail["notifications"])
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(User)) == original_count
        assert session.get(Issue, issue_id).user_id is None
        assert all(
            n.max_user_id is None and n.suppressed_at is not None
            for n in session.scalars(
                select(StaffNotification).where(StaffNotification.issue_id == issue_id)
            )
        )
    # Contact data never leaks through a public common-area report.
    public = client.get(f"/api/v1/issues/{issue_id}", headers=headers()).json()
    assert public["mine"] is False and body["reporter_phone"] not in str(public)
    rejection = {
        "reason": "Дубликат обращения",
        "expected_status": "in_progress",
        "request_id": str(uuid4()),
    }
    rejected = client.post(ROOT + f"/issues/{issue_id}/reject", headers=csrf, json=rejection)
    assert rejected.status_code == 200, rejected.text
    assert (
        client.post(ROOT + f"/issues/{issue_id}/reject", headers=csrf, json=rejection).json()
        == rejected.json()
    )


def test_creation_requires_staff_csrf_and_house_scope(staff_api):
    client, _, _ = staff_api
    assert client.post(ROOT + "/issues", json=report()).status_code == 401
    assert client.get(ROOT + "/houses/1/issue-options").status_code == 401
    csrf = login(client)
    assert client.post(ROOT + "/issues", json=report()).status_code == 403
    assert client.post(ROOT + "/issues", headers=csrf, json=report(house_id=2)).status_code == 404
    assert client.get(ROOT + "/houses/2/issue-options").status_code == 404
    assert client.get(ROOT + "/houses/2/report-residents").status_code == 404


def test_simultaneous_retries_create_one_report_and_one_initial_event(staff_api):
    client, engine, _ = staff_api
    if engine.dialect.name != "postgresql":
        pytest.skip("Concurrent insert proof uses PostgreSQL")
    csrf = login(client)
    body = manual()
    barrier = Barrier(2)

    def create():
        barrier.wait(timeout=10)
        return client.post(ROOT + "/issues", headers=csrf, json=body)

    with ThreadPoolExecutor(max_workers=2) as pool:
        one, two = [task.result(timeout=20) for task in (pool.submit(create), pool.submit(create))]
    assert one.status_code == two.status_code == 201
    assert one.json()["id"] == two.json()["id"]
    with Session(engine) as session:
        assert (
            session.scalar(
                select(func.count())
                .select_from(Issue)
                .where(Issue.staff_request_id == body["request_id"])
            )
            == 1
        )
        assert (
            session.scalar(
                select(func.count())
                .select_from(IssueEvent)
                .where(IssueEvent.issue_id == one.json()["id"])
            )
            == 1
        )


@pytest.mark.parametrize(
    "changes",
    [
        {"resident_id": 3},
        {"resident_id": 999},
        {"reporter_apartment_id": 3},
        {"reporter_apartment_id": 2},
        {"reporter_phone": "call me"},
        {"place": {"zone": "corridor", "entrance": 100, "floor": 1}},
        {"place": {"zone": "entrance", "entrance": 1, "floor": 2}},
        {"place": {"zone": "apartment", "entrance": 2, "floor": 1, "apartment_id": 2}},
        {"category": "yard"},
        {"title": " "},
        {"description": "a" * 2001},
        {"resident_id": None},
        {"reporter_name": "Fake account name"},
    ],
)
def test_invalid_report_never_inserts_an_issue(staff_api, changes):
    client, engine, _ = staff_api
    csrf = login(client)
    before = client.get(ROOT + "/issues").json()["total"]
    response = client.post(ROOT + "/issues", headers=csrf, json=report(**changes))
    assert response.status_code == 422, response.text
    assert client.get(ROOT + "/issues").json()["total"] == before


def test_options_and_resident_search_are_limited_to_selected_house(staff_api):
    client, _, _ = staff_api
    login(client)
    choices = client.get(ROOT + "/houses/1/report-residents").json()
    assert {p["id"] for p in choices["items"]} == {1, 2}
    assert client.get(ROOT + "/houses/1/report-residents?q=кв. 7").json()["items"][0]["id"] == 1
    assert client.get(ROOT + "/houses/1/report-residents?q=Первый").json()["total"] == 1
    options = client.get(ROOT + "/houses/1/issue-options").json()
    assert {a["id"] for a in options["apartments"]} == {1, 2}
    assert (
        "yard" in options["categories"]["courtyard"]
        and "yard" not in options["categories"]["apartment"]
    )


def test_manual_apartment_issue_is_private_and_does_not_claim_ownership(staff_api):
    client, _, _ = staff_api
    csrf = login(client)
    response = client.post(
        ROOT + "/issues",
        headers=csrf,
        json=manual(place={"zone": "apartment", "entrance": 1, "floor": 1, "apartment_id": 1}),
    )
    assert response.status_code == 201, response.text
    issue_id = response.json()["id"]
    assert client.get(f"/api/v1/issues/{issue_id}", headers=headers()).status_code == 404
    assert client.get(ROOT + f"/issues/{issue_id}").status_code == 200


def test_staff_intake_migration_preserves_existing_rows_and_refuses_data_loss(tmp_path):
    path = Path(__file__).resolve().parents[1] / "migrations/versions/0020_staff_issue_creation.py"
    spec = importlib.util.spec_from_file_location("staff_intake", path)
    migration = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(migration)
    engine = create_engine(f"sqlite:///{tmp_path / 'staff_reports.db'}")
    try:
        with (
            engine.begin() as connection,
            Operations.context(MigrationContext.configure(connection)),
        ):
            connection.execute(text("CREATE TABLE staff_users (id INTEGER PRIMARY KEY)"))
            connection.execute(
                text(
                    "CREATE TABLE issues "
                    "(id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, title TEXT)"
                )
            )
            connection.execute(
                text(
                    "CREATE TABLE staff_notifications "
                    "(id INTEGER PRIMARY KEY, max_user_id BIGINT NOT NULL)"
                )
            )
            connection.execute(text("INSERT INTO issues VALUES (1, 1, 'Existing')"))
            migration.upgrade()
            assert connection.scalar(text("SELECT title FROM issues")) == "Existing"
            assert next(
                c for c in inspect(connection).get_columns("issues") if c["name"] == "user_id"
            )["nullable"]
            connection.execute(
                text(
                    "INSERT INTO issues (id, created_by_staff_id, reporter_name, reporter_phone) "
                    "VALUES (2, 1, 'Caller', '112')"
                )
            )
            with pytest.raises(RuntimeError, match="reporter data"):
                migration.downgrade()
            connection.execute(text("DELETE FROM issues WHERE id = 2"))
            migration.downgrade()
            assert connection.scalar(text("SELECT title FROM issues")) == "Existing"
            assert not next(
                c for c in inspect(connection).get_columns("issues") if c["name"] == "user_id"
            )["nullable"]
    finally:
        engine.dispose()
