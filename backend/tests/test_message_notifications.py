from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.orm import Session
from tests.test_api import headers

from app.database.models import MessageNotification, UserApartment

pytest_plugins = ["tests.test_api"]


def test_notifications_are_queued_once_for_all_recipient_residents(api):
    client, engine, _ = api
    with Session(engine) as session:
        session.add(UserApartment(user_id=4, apartment_id=2))
        session.add(UserApartment(user_id=1, apartment_id=2))
        session.commit()
    body = {"recipient_id": 2, "text": "Здравствуйте!", "request_id": str(uuid4())}
    first = client.post("/api/v1/apartments/1/messages", headers=headers(), json=body)
    assert first.status_code == 201
    repeated = client.post("/api/v1/apartments/1/messages", headers=headers(), json=body)
    assert repeated.json()["id"] == first.json()["id"]
    with Session(engine) as session:
        queued = list(session.scalars(select(MessageNotification)))
        assert {row.max_user_id for row in queued} == {102, 104}
        assert len(queued) == 2
        assert all(row.message_id == first.json()["id"] and row.sent_at is None for row in queued)


def test_invalid_message_does_not_queue_notification(api):
    client, engine, _ = api
    response = client.post(
        "/api/v1/apartments/1/messages",
        headers=headers(),
        json={
            "recipient_id": 3,
            "text": "Другой дом",
            "request_id": str(uuid4()),
        },
    )
    assert response.status_code == 422
    with Session(engine) as session:
        assert list(session.scalars(select(MessageNotification))) == []


def test_worker_retries_outage_and_does_not_redeliver_success(api):
    import asyncio
    from datetime import UTC, datetime, timedelta
    from unittest.mock import AsyncMock

    import pytest
    from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

    pytest.importorskip("maxapi")
    pytest.importorskip("environs")
    from chatbot.services.message_notifications import deliver_pending

    client, engine, _ = api
    client.post(
        "/api/v1/apartments/1/messages",
        headers=headers(),
        json={
            "recipient_id": 2,
            "text": "Соседям",
            "request_id": str(uuid4()),
        },
    )

    async def run():
        database = create_async_engine(f"sqlite+aiosqlite:///{engine.url.database}")
        sessions = async_sessionmaker(database, expire_on_commit=False)
        bot = AsyncMock()
        bot.send_message.side_effect = RuntimeError("outage")
        try:
            await deliver_pending(bot, sessions)
            with Session(engine) as session:
                row = session.scalar(select(MessageNotification))
                assert row.attempts == 1 and row.sent_at is None
                row.available_at = datetime.now(UTC) - timedelta(seconds=1)
                session.commit()
            bot.send_message.side_effect = None
            bot.send_message.return_value = object()
            await deliver_pending(bot, sessions)
            await deliver_pending(bot, sessions)
            assert bot.send_message.call_count == 2
            assert bot.send_message.call_args.kwargs["user_id"] == 102
            assert "квартиры 7" in bot.send_message.call_args.kwargs["text"]
            with Session(engine) as session:
                assert session.scalar(select(MessageNotification)).sent_at is not None
        finally:
            await database.dispose()

    asyncio.run(run())
