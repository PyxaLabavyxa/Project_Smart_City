import hashlib
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime
from threading import Barrier

import pytest
from app.database.enums import IssuePriority, IssueStatus
from app.database.models import InboxNotification, Issue, IssueEvent, StaffNotification
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from smart_city_api.schemas.staff import StaffCreateIssue
from tests.test_api import headers
from tests.test_staff import ORIGIN, ROOT, issue_token, login
from tests.test_staff_reports import manual, report

pytest_plugins = ["tests.test_staff"]


@pytest.mark.parametrize("priority", [1, 2, 3])
@pytest.mark.parametrize("make_report", [report, manual])
def test_staff_selects_priority_at_creation(staff_api, priority, make_report):
    client, engine, _ = staff_api
    csrf = login(client)
    body = make_report(priority=priority)
    saved = client.post(ROOT + "/issues", headers=csrf, json=body)
    assert saved.status_code == 201, saved.text
    created = saved.json()
    assert created["priority"] == priority
    assert client.post(ROOT + "/issues", headers=csrf, json=body).json()["id"] == created["id"]
    assert (
        client.post(
            ROOT + "/issues", headers=csrf, json={**body, "priority": priority % 3 + 1}
        ).status_code
        == 409
    )
    assert created["id"] in {
        r["id"] for r in client.get(ROOT + f"/issues?priority={priority}").json()["items"]
    }
    with Session(engine) as session:
        assert session.get(Issue, created["id"]).priority == IssuePriority(priority)


def test_old_creation_retry_hashes_still_match_default_priority(staff_api):
    client, engine, _ = staff_api
    csrf = login(client)
    body = report()
    created = client.post(ROOT + "/issues", headers=csrf, json=body).json()
    data = StaffCreateIssue.model_validate(body)
    legacy = hashlib.sha256(data.model_dump_json(exclude={"request_id", "priority"}).encode())
    with Session(engine) as session:
        issue = session.get(Issue, created["id"])
        assert issue.priority == IssuePriority.MEDIUM
        issue.staff_request_hash = legacy.hexdigest()
        session.commit()
    assert (
        client.post(ROOT + "/issues", headers=csrf, json={**body, "priority": 2}).json()["id"]
        == created["id"]
    )


@pytest.mark.parametrize("issue_id,expected,target", [(1, 1, 2), (1, 1, 3), (2, 3, 1)])
def test_edit_changes_only_priority_and_retries_are_safe(staff_api, issue_id, expected, target):
    client, engine, _ = staff_api
    csrf = login(client)
    before = client.get(ROOT + f"/issues/{issue_id}").json()
    with Session(engine) as session:
        notice_count = session.scalar(select(func.count()).select_from(InboxNotification))
    path = ROOT + f"/issues/{issue_id}/priority"
    body = {"priority": target, "expected_priority": expected}
    result = client.post(path, headers=csrf, json=body)
    assert result.status_code == 200, result.text
    assert result.json() == {"priority": target, "changed": True}
    assert client.post(path, headers=csrf, json=body).json() == {
        "priority": target,
        "changed": False,
    }
    after = client.get(ROOT + f"/issues/{issue_id}").json()
    assert after == {**before, "priority": target}
    assert (
        client.get(
            f"/api/v1/issues/{issue_id}", headers=headers(101 if issue_id == 1 else 102)
        ).json()["priority"]
        == target
    )
    assert issue_id in {
        r["id"] for r in client.get(ROOT + f"/issues?priority={target}").json()["items"]
    }
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(StaffNotification)) == 0
        assert session.scalar(select(func.count()).select_from(IssueEvent)) == 0
        assert session.scalar(select(func.count()).select_from(InboxNotification)) == notice_count


def test_conflicting_update_does_not_overwrite_another_employee(staff_api):
    client, _, _ = staff_api
    csrf = login(client)
    path = ROOT + "/issues/1/priority"
    assert (
        client.post(path, headers=csrf, json={"priority": 2, "expected_priority": 1}).status_code
        == 200
    )
    stale = client.post(path, headers=csrf, json={"priority": 3, "expected_priority": 1})
    assert stale.status_code == 409
    assert client.get(ROOT + "/issues/1").json()["priority"] == 2
    # A refreshed card can change it again.
    assert (
        client.post(path, headers=csrf, json={"priority": 3, "expected_priority": 2}).status_code
        == 200
    )


def test_create_retry_after_manual_edit_does_not_reset_priority(staff_api):
    client, _, _ = staff_api
    csrf = login(client)
    body = report(priority=3)
    created = client.post(ROOT + "/issues", headers=csrf, json=body).json()
    assert (
        client.post(
            ROOT + f"/issues/{created['id']}/priority",
            headers=csrf,
            json={"priority": 1, "expected_priority": 3},
        ).status_code
        == 200
    )
    retry = client.post(ROOT + "/issues", headers=csrf, json=body)
    assert retry.status_code == 201 and retry.json()["priority"] == 1


@pytest.mark.parametrize("invalid", [0, 4, -1, None, "1", True, 1.5, {}, []])
def test_invalid_values_are_rejected_for_creation_and_edit(staff_api, invalid):
    client, _, _ = staff_api
    csrf = login(client)
    assert (
        client.post(ROOT + "/issues", headers=csrf, json=report(priority=invalid)).status_code
        == 422
    )
    for body in (
        {"priority": invalid, "expected_priority": 1},
        {"priority": 2, "expected_priority": invalid},
    ):
        assert client.post(ROOT + "/issues/1/priority", headers=csrf, json=body).status_code == 422
    assert client.get(ROOT + "/issues/1").json()["priority"] == 1


def test_staff_auth_csrf_house_scope_and_removed_issues(staff_api):
    client, engine, _ = staff_api
    body = {"priority": 2, "expected_priority": 1}
    path = ROOT + "/issues/1/priority"
    assert client.post(path, json=body).status_code == 401
    csrf = login(client)
    assert client.post(path, headers=ORIGIN, json=body).status_code == 403
    assert (
        client.post(
            path, headers={**csrf, "Origin": "https://outside.example"}, json=body
        ).status_code
        == 403
    )
    assert client.post(ROOT + "/issues/3/priority", headers=csrf, json=body).status_code == 404
    assert client.post(ROOT + "/issues/9999/priority", headers=csrf, json=body).status_code == 404
    for field in ("deleted_at", "rejected_at"):
        with Session(engine) as session:
            setattr(session.get(Issue, 1), field, datetime.now(UTC))
            session.commit()
        assert client.post(path, headers=csrf, json=body).status_code == 404
        with Session(engine) as session:
            setattr(session.get(Issue, 1), field, None)
            session.commit()


def test_token_auth_and_request_cannot_change_other_fields(staff_api):
    client, _, _ = staff_api
    token = issue_token(client).json()["access_token"]
    authorization = {"Authorization": "Bearer " + token}
    path = ROOT + "/issues/1/priority"
    assert (
        client.post(
            path,
            headers=authorization,
            json={"priority": 2, "expected_priority": 1, "status": "resolved"},
        ).status_code
        == 422
    )
    assert (
        client.post(
            path, headers=authorization, json={"priority": 2, "expected_priority": 1}
        ).status_code
        == 200
    )
    assert client.get(ROOT + "/issues/1", headers=authorization).json()["status"] == "new"


def test_concurrent_edits_only_one_wins(staff_api):
    client, engine, _ = staff_api
    if engine.dialect.name != "postgresql":
        pytest.skip("Row lock concurrency proof uses PostgreSQL")
    csrf = login(client)
    barrier = Barrier(2)

    def change(target):
        barrier.wait(timeout=10)
        return client.post(
            ROOT + "/issues/1/priority",
            headers=csrf,
            json={"priority": target, "expected_priority": 1},
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(change, [2, 3]))
    assert sorted(r.status_code for r in results) == [200, 409]
    winner = next(r for r in results if r.status_code == 200).json()["priority"]
    with Session(engine) as session:
        assert session.get(Issue, 1).priority == IssuePriority(winner)
        assert session.get(Issue, 1).status == IssueStatus.NEW
