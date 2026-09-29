import asyncio
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from app.database.models import MessageNotification, MiniAppPresence
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from sqlalchemy.orm import Session

from tests.test_api import headers

pytest_plugins = ["tests.test_api"]


def heartbeat(client, client_id, active=True, sequence=1, user=102):
    return client.post(
        "/api/v1/auth/presence",
        headers=headers(user),
        json={
            "client_id": client_id,
            "active": active,
            "sequence": sequence,
        },
    )


def test_presence_requires_auth_and_ignores_out_of_order_updates(api):
    client, engine, _ = api
    tab = str(uuid4())
    assert (
        client.post(
            "/api/v1/auth/presence",
            json={
                "client_id": tab,
                "active": True,
                "sequence": 1,
            },
        ).status_code
        == 401
    )
    assert heartbeat(client, tab).status_code == 204
    assert heartbeat(client, tab, active=False, sequence=3).status_code == 204
    assert heartbeat(client, tab, sequence=2).status_code == 204
    assert heartbeat(client, tab, sequence=4, user=101).status_code == 204
    with Session(engine) as session:
        row = session.get(MiniAppPresence, (2, tab))
        assert row.sequence == 3
        assert row.expires_at.replace(tzinfo=UTC) <= datetime.now(UTC)
        assert session.get(MiniAppPresence, (1, tab)).expires_at.replace(tzinfo=UTC) > datetime.now(
            UTC
        )


@pytest.mark.parametrize(
    "state,expected",
    [("active", 0), ("closed", 1), ("expired", 1), ("other-tab-open", 0), ("other-user", 1)],
)
def test_worker_suppresses_only_currently_active_recipient(api, state, expected):
    from chatbot.services.message_notifications import deliver_pending

    client, engine, _ = api
    tab = str(uuid4())
    assert heartbeat(client, tab, user=101 if state == "other-user" else 102).status_code == 204
    if state in ("closed", "other-tab-open"):
        assert heartbeat(client, tab, active=False, sequence=2).status_code == 204
    if state == "other-tab-open":
        assert heartbeat(client, str(uuid4())).status_code == 204
    if state == "expired":
        with Session(engine) as session:
            session.get(MiniAppPresence, (2, tab)).expires_at = datetime.now(UTC) - timedelta(
                seconds=1
            )
            session.commit()
    assert (
        client.post(
            "/api/v1/apartments/1/messages",
            headers=headers(),
            json={
                "recipient_id": 2,
                "text": "Сообщение",
                "request_id": str(uuid4()),
            },
        ).status_code
        == 201
    )

    async def run():
        database = create_async_engine(f"sqlite+aiosqlite:///{engine.url.database}")
        bot = AsyncMock()
        bot.send_message.return_value = object()
        try:
            sessions = async_sessionmaker(database, expire_on_commit=False)
            await deliver_pending(bot, sessions)
            assert bot.send_message.call_count == expected
            with Session(engine) as session:
                notification = session.scalar(select(MessageNotification))
                assert (notification.suppressed_at is not None) == (expected == 0)
                for row in session.scalars(select(MiniAppPresence)):
                    row.expires_at = datetime.now(UTC) - timedelta(seconds=1)
                session.commit()
            await deliver_pending(bot, sessions)
            assert bot.send_message.call_count == expected
        finally:
            await database.dispose()

    asyncio.run(run())
