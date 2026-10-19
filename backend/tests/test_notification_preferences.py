import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from app.database.models import MessageNotification, StaffNotification, User
from sqlalchemy import select
from sqlalchemy.orm import Session

from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory
from tests.test_api import headers, launch
from tests.test_staff import ROOT, login, status_body

pytest_plugins = ["tests.test_staff"]
PATH = "/api/v1/me/notifications"
DEFAULTS = dict(
    personal_messages=True, issue_messages=True, issue_statuses=True, announcements=True
)


def test_preferences_default_to_enabled_and_are_private_to_account(api):
    client, engine, _ = api
    assert client.get(PATH).status_code == 401
    assert client.get(PATH, headers=headers()).json() == DEFAULTS
    changed = {**DEFAULTS, "personal_messages": False, "announcements": False}
    assert client.post(PATH, headers=headers(), json=changed).json() == changed
    assert client.get(PATH, headers=headers()).json() == changed
    assert client.get(PATH, headers=headers(102)).json() == DEFAULTS
    with Session(engine) as session:
        assert session.get(User, 1).notify_personal_messages is False
        assert session.get(User, 2).notify_personal_messages is True


@pytest.mark.parametrize("changes", [{"personal_messages": "false"}, {"user_id": 2}])
def test_preferences_reject_coercion_and_other_user_ids(api, changes):
    client, _, _ = api
    assert client.post(PATH, headers=headers(), json={**DEFAULTS, **changes}).status_code == 422
    assert client.get(PATH, headers=headers()).json() == DEFAULTS


def test_cookie_preferences_require_allowed_origin(api):
    client, _, _ = api
    client.base_url = "https://testserver"
    origin = client.app.state.settings.cors_origins[0]
    assert (
        client.post(
            "/api/v1/auth/max", headers={"Origin": origin}, json={"init_data": launch()}
        ).status_code
        == 204
    )
    assert (
        client.post(PATH, headers={"Origin": "https://foreign.invalid"}, json=DEFAULTS).status_code
        == 403
    )
    assert client.post(PATH, headers={"Origin": origin}, json=DEFAULTS).status_code == 200


def test_muted_personal_notification_is_not_delivered_or_replayed(api):
    pytest.importorskip("maxapi")
    from chatbot.services.message_notifications import deliver_pending

    client, engine, _ = api
    response = client.post(
        "/api/v1/apartments/1/messages",
        headers=headers(),
        json={"recipient_id": 2, "text": "Тест", "request_id": str(uuid4())},
    )
    assert response.status_code == 201
    # Disable after queueing, as a resident can change preferences at any time.
    assert (
        client.post(
            PATH, headers=headers(102), json={**DEFAULTS, "personal_messages": False}
        ).status_code
        == 200
    )

    async def run():
        db = Database(client.app.state.database.engine.url)
        bot = SimpleNamespace(send_message=AsyncMock(return_value=object()))
        try:
            await deliver_pending(bot, db.sessions)
            with Session(engine) as session:
                queued = session.scalar(select(MessageNotification))
                assert queued.suppressed_at is not None and queued.sent_at is None
                session.get(User, 2).notify_personal_messages = True
                session.commit()
            await deliver_pending(bot, db.sessions)
            bot.send_message.assert_not_awaited()
        finally:
            await db.close()

    asyncio.run(run(), loop_factory=loop_factory)
    # The actual conversation is still available when notifications are muted.
    assert (
        len(client.get("/api/v1/apartments/2/messages", headers=headers(102)).json()["items"]) == 1
    )


@pytest.mark.parametrize(
    "messages,statuses,expected",
    [(False, True, 1), (True, False, 1), (False, False, 0), (True, True, 2)],
)
def test_staff_notifications_obey_separate_message_and_status_switches(
    staff_api, messages, statuses, expected
):
    pytest.importorskip("maxapi")
    from chatbot.services.staff_notifications import deliver_pending

    client, engine, _ = staff_api
    csrf = login(client)
    assert (
        client.post(ROOT + "/issues/1/status", json=status_body(), headers=csrf).status_code == 200
    )
    assert (
        client.post(
            ROOT + "/issues/1/messages",
            json={"text": "Ответ УК", "request_id": str(uuid4())},
            headers=csrf,
        ).status_code
        == 200
    )
    assert (
        client.post(
            PATH,
            headers=headers(),
            json={**DEFAULTS, "issue_messages": messages, "issue_statuses": statuses},
        ).status_code
        == 200
    )

    async def run():
        db = Database(client.app.state.database.engine.url)
        bot = SimpleNamespace(send_message=AsyncMock(return_value=object()))
        try:
            assert await deliver_pending(bot, db.sessions) == expected
            assert bot.send_message.await_count == expected
            with Session(engine) as session:
                queued = list(session.scalars(select(StaffNotification)))
                for row in queued:
                    enabled = messages if row.kind == "message" else statuses
                    assert (row.sent_at is not None) == enabled
                    assert (row.suppressed_at is not None) != enabled
                user = session.get(User, 1)
                user.notify_issue_messages = user.notify_issue_statuses = True
                session.commit()
            assert await deliver_pending(bot, db.sessions) == 0
        finally:
            await db.close()

    asyncio.run(run(), loop_factory=loop_factory)
