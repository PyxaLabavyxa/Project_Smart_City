import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch
from uuid import uuid4

import pytest
from app.database.enums import IssueCategory, IssuePriority
from app.database.models import Issue, IssueMessage, MiniAppPresence, StaffNotification
from sqlalchemy import select
from sqlalchemy.orm import Session

from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory
from tests.test_api import headers
from tests.test_staff import ROOT, login, status_body

pytest_plugins = ["tests.test_staff"]


def presence(client, tab, *, issue=1, active=True, sequence=1, seen=None, user=101):
    return client.post(
        f"/api/v1/issues/{issue}/presence", headers=headers(user),
        json={"client_id": tab, "active": active, "sequence": sequence, "last_message_id": seen},
    )


def staff_message(client, csrf, issue=1):
    response = client.post(
        f"{ROOT}/issues/{issue}/messages",
        headers=csrf, json={"text": "Ответ УК", "request_id": str(uuid4())},
    )
    assert response.status_code == 200, response.text
    return client.get(f"{ROOT}/issues/{issue}").json()["messages"][-1]["id"]


def deliver(client):
    from chatbot.services.staff_notifications import deliver_pending

    async def run():
        database = Database(client.app.state.database.engine.url)
        bot = SimpleNamespace(send_message=AsyncMock(return_value=object()))
        try:
            await deliver_pending(bot, database.sessions)
            return bot.send_message.await_count
        finally:
            await database.close()
    return asyncio.run(run(), loop_factory=loop_factory)


def test_read_messages_never_become_notifications_after_chat_closes(staff_api):
    client, engine, _ = staff_api
    csrf = login(client)
    tab = str(uuid4())
    assert presence(client, tab).status_code == 204
    mid = staff_message(client, csrf)
    assert deliver(client) == 0
    assert presence(client, tab, seen=mid, sequence=2).status_code == 204
    assert presence(client, tab, active=False, seen=mid, sequence=3).status_code == 204
    assert deliver(client) == 0
    assert client.get(ROOT + "/issues/1").json()["notifications"][0]["delivery"] == "read"
    with Session(engine) as session:
        notice = session.scalar(select(StaffNotification))
        assert notice.suppressed_at is not None and notice.sent_at is None and notice.attempts == 0
    staff_message(client, csrf)
    assert deliver(client) == 1


@pytest.mark.parametrize("exit_mode", ["closed", "expired"])
def test_unread_message_is_delivered_after_leaving_or_connection_loss(staff_api, exit_mode):
    client, engine, _ = staff_api
    csrf = login(client)
    tab = str(uuid4())
    presence(client, tab)
    staff_message(client, csrf)
    assert deliver(client) == 0
    if exit_mode == "closed":
        assert presence(client, tab, active=False, sequence=2).status_code == 204
    else:
        with Session(engine) as session:
            row = session.get(MiniAppPresence, (1, tab))
            row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
            session.commit()
    assert deliver(client) == 1
    assert deliver(client) == 0


@pytest.mark.parametrize("scope", ["app", "other-issue", "other-user"])
def test_only_current_authors_exact_chat_mutes_notifications(staff_api, scope):
    client, engine, _ = staff_api
    csrf = login(client)
    if scope == "app":
        client.post("/api/v1/auth/presence", headers=headers(), json={
            "client_id": str(uuid4()), "sequence": 1, "active": True,
        })
    elif scope == "other-issue":
        with Session(engine) as session:
            issue = Issue(
                user_id=1, house_id=1, title="Другое обращение", description="Проверка",
                category=IssueCategory.OTHER, priority=IssuePriority.MEDIUM,
            )
            session.add(issue)
            session.commit()
            other_id = issue.id
        assert presence(client, str(uuid4()), issue=other_id).status_code == 204
    else:
        assert presence(client, str(uuid4()), issue=2, user=102).status_code == 204
    staff_message(client, csrf)
    assert deliver(client) == 1


def test_second_tab_keeps_chat_open_and_stale_heartbeat_cannot_reopen_it(staff_api):
    client, _, _ = staff_api
    csrf = login(client)
    tabs = [str(uuid4()), str(uuid4())]
    for tab in tabs:
        presence(client, tab)
    presence(client, tabs[0], active=False, sequence=3)
    presence(client, tabs[0], sequence=2)
    staff_message(client, csrf)
    assert deliver(client) == 0
    presence(client, tabs[1], active=False, sequence=2)
    assert deliver(client) == 1


def test_status_notification_is_not_blocked_by_unread_chat_message(staff_api):
    client, _, _ = staff_api
    csrf = login(client)
    tab = str(uuid4())
    presence(client, tab)
    mid = staff_message(client, csrf)
    response = client.post(ROOT + "/issues/1/status", headers=csrf, json=status_body())
    assert response.status_code == 200
    assert deliver(client) == 1  # Status goes through while the chat message waits for reading.
    presence(client, tab, seen=mid, sequence=2)
    presence(client, tab, active=False, sequence=3)
    assert deliver(client) == 0


def test_presence_checks_auth_ownership_and_receipt_scope(staff_api):
    client, engine, _ = staff_api
    tab = str(uuid4())
    body = {"client_id": tab, "sequence": 1, "active": True}
    assert client.post("/api/v1/issues/1/presence", json=body).status_code == 401
    for issue in (2, 3, 999):
        assert presence(client, tab, issue=issue).status_code == 404
    assert presence(client, tab, user=102).status_code == 404
    with Session(engine) as session:
        other = IssueMessage(issue_id=2, user_id=2, text="Чужой чат", request_id="other")
        session.add(other)
        session.commit()
        mid = other.id
    assert presence(client, tab, seen=mid).status_code == 422
    assert presence(client, tab, seen=99999).status_code == 422
    assert presence(client, tab, sequence=0).status_code == 422
    with Session(engine) as session:
        session.get(Issue, 1).rejected_at = datetime.now(UTC)
        session.commit()
    assert presence(client, tab).status_code == 404


def test_opening_chat_after_claim_releases_notification_without_sending(staff_api):
    from chatbot.services import staff_notifications as worker

    client, _, _ = staff_api
    csrf = login(client)
    staff_message(client, csrf)
    tab = str(uuid4())
    original = worker.claim_next

    async def open_after_claim(sessions):
        claim = await original(sessions)
        if claim is not None:
            assert presence(client, tab).status_code == 204
        return claim

    with patch.object(worker, "claim_next", side_effect=open_after_claim):
        assert deliver(client) == 0
    presence(client, tab, active=False, sequence=2)
    assert deliver(client) == 1
