import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest
from app.database.models import StaffNotification
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory
from tests.test_staff import ROOT, login, status_body

pytest_plugins = ["tests.test_staff"]


def test_worker_lease_retry_order_and_no_redelivery(staff_api):
    pytest.importorskip("maxapi")
    from chatbot.services.staff_notifications import claim_next, deliver_pending

    client, engine, _ = staff_api
    csrf = login(client)
    assert (
        client.post(ROOT + "/issues/1/status", json=status_body(), headers=csrf).status_code == 200
    )
    assert (
        client.post(
            ROOT + "/issues/1/messages",
            json={"text": "Уточнение", "request_id": str(uuid4())},
            headers=csrf,
        ).status_code
        == 200
    )

    async def run():
        database = Database(client.app.state.database.engine.url)
        bot = SimpleNamespace(send_message=AsyncMock(side_effect=RuntimeError("offline")))
        try:
            assert await deliver_pending(bot, database.sessions) == 0
            assert (
                bot.send_message.await_count == 1
            )
            with Session(engine) as session:
                row = session.scalar(select(StaffNotification).order_by(StaffNotification.id))
                assert row.attempts == 1 and row.sent_at is None and row.lease_token is None
                row.available_at = datetime.now(UTC) - timedelta(seconds=1)
                session.commit()
            claim = await claim_next(database.sessions)
            assert claim is not None
            assert await claim_next(database.sessions) is None
            with Session(engine) as session:
                row = session.get(StaffNotification, claim[0].id)
                row.available_at = datetime.now(UTC) - timedelta(seconds=1)
                session.commit()

            async def sent(**kwargs):
                import inspect

                from maxapi import Bot

                inspect.signature(Bot.send_message).bind(None, **kwargs)
                with Session(engine) as session:
                    assert (
                        session.scalar(
                            select(func.count())
                            .select_from(StaffNotification)
                            .where(StaffNotification.lease_token.is_not(None))
                        )
                        == 1
                    )
                assert await claim_next(database.sessions) is None
                assert kwargs["user_id"] == 101
                button = kwargs["attachments"][0].payload.buttons[0][0]
                assert button.url.endswith("?startapp=issue_1")
                assert kwargs["attachments"][0].payload.buttons[1][0].web_app
                return object()

            bot.send_message.side_effect = sent
            assert await deliver_pending(bot, database.sessions) == 2
            assert await deliver_pending(bot, database.sessions) == 0
            with Session(engine) as session:
                rows = list(session.scalars(select(StaffNotification)))
                assert all(row.sent_at is not None and row.lease_token is None for row in rows)
        finally:
            await database.close()

    asyncio.run(run(), loop_factory=loop_factory)
    assert all(
        n["delivery"] == "sent" for n in client.get(ROOT + "/issues/1").json()["notifications"]
    )


def test_legacy_reply_buttons_preserve_report_draft(staff_api):
    from chatbot.handlers import staff_messages as handler
    from chatbot.states.states import FSMReport
    from maxapi.context import MemoryContext

    async def run():
        context = MemoryContext(1, 101)
        draft = {"description": "Мой черновик", "photos": [{"id": "test-photo"}], "house_id": 1}
        event = SimpleNamespace(
            callback=SimpleNamespace(payload="staff_reply_1"),
            message=SimpleNamespace(answer=AsyncMock()),
        )
        try:
            await context.clear()
            await context.set_state(FSMReport.confirm)
            await context.update_data(**draft)
            await handler.start_reply(event)
            markup = event.message.answer.await_args.kwargs["attachments"][0]
            assert markup.payload.buttons[0][0].url.endswith("?startapp=issue_1")
            await handler.cancel_reply(event)
            assert await context.get_state() == FSMReport.confirm
            assert await context.get_data() == draft
        finally:
            await context.clear()

    asyncio.run(run(), loop_factory=loop_factory)


def test_staff_migration_preserves_existing_rows_and_matches_models(tmp_path, monkeypatch):
    from pathlib import Path

    from alembic import command
    from alembic.autogenerate import compare_metadata
    from alembic.config import Config
    from alembic.migration import MigrationContext
    from app.database.models import Base
    from sqlalchemy import create_engine, text

    path = tmp_path / "migration.db"
    monkeypatch.setenv("DATABASE_URL", f"sqlite+aiosqlite:///{path}")
    config = Config(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    engine = create_engine(f"sqlite:///{path}")
    try:
        command.upgrade(config, "0003")
        with engine.begin() as connection:
            connection.execute(text("INSERT INTO users(max_user_id, name) VALUES(1, 'existing')"))
        command.upgrade(config, "head")
        with engine.connect() as connection:
            assert connection.scalar(text("SELECT name FROM users")) == "existing"
            assert compare_metadata(MigrationContext.configure(connection), Base.metadata) == []
        command.downgrade(config, "0003")
        command.upgrade(config, "head")
    finally:
        engine.dispose()
