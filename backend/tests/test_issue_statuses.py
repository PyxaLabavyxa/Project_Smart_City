import asyncio
from uuid import uuid4

import pytest
from app.database.repositories.repositories import IssueRepository

from tests.test_api import headers
from tests.test_staff import ROOT, login

pytest_plugins = ["tests.test_staff"]

STATES = ["new", "accepted", "assigned", "in_progress", "resolved"]


def test_staff_can_progress_through_all_five_states_with_resident_history(staff_api):
    client, _, _ = staff_api
    csrf = login(client)
    expected = "new"
    for status in STATES[1:]:
        payload = {"status": status, "expected_status": expected, "request_id": str(uuid4())}
        response = client.post(ROOT + "/issues/1/status", json=payload, headers=csrf)
        assert response.status_code == 200, response.text
        assert (
            client.post(ROOT + "/issues/1/status", json=payload, headers=csrf).json()
            == response.json()
        )
        detail = client.get("/api/v1/issues/1", headers=headers()).json()
        assert detail["status"] == status
        assert detail["history"][-1]["status"] == status
        filtered = client.get(ROOT + "/issues", params={"status": status}).json()
        assert 1 in [row["id"] for row in filtered["items"]]
        assert list(filtered["counts"]) == STATES
        assert client.get(ROOT + "/issues", params={"status": expected}).json()["items"] == []
        expected = status
    inbox = client.get("/api/v1/me/inbox", headers=headers()).json()
    titles = [row["title"] for row in inbox["items"]]
    assert any("принято" in title for title in titles)
    assert any("назначен исполнитель" in title for title in titles)


@pytest.mark.parametrize("status", ["accepted", "assigned"])
def test_new_states_keep_conflict_scope_and_bot_statistics(staff_api, status):
    client, _, _ = staff_api
    csrf = login(client)
    body = {"status": status, "expected_status": "new", "request_id": str(uuid4())}
    assert client.post(ROOT + "/issues/3/status", json=body, headers=csrf).status_code == 404
    assert client.post(ROOT + "/issues/1/status", json=body, headers=csrf).status_code == 200
    assert (
        client.post(
            ROOT + "/issues/1/status", json={**body, "request_id": str(uuid4())}, headers=csrf
        ).status_code
        == 409
    )

    async def counts():
        async with client.app.state.database.sessions() as session:
            return await IssueRepository(session).get_issue_statuses(101, 1)

    result = asyncio.run(counts())
    assert result[status] == 1
    assert sum(result.values()) == 1
