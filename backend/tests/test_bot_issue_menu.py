import asyncio
from datetime import UTC, datetime, timedelta
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from app.database.enums import IssueCategory, IssuePriority
from app.database.models import Issue, IssueMessage, StaffNotification, UserApartment
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory

pytest_plugins = ["tests.test_staff"]


def callback_event():
    return SimpleNamespace(
        callback=SimpleNamespace(payload="house_1", user=SimpleNamespace(user_id=101)),
        from_user=SimpleNamespace(user_id=101),
        message=SimpleNamespace(
            body=SimpleNamespace(
                text="Когда планируется ремонт?", mid="question-1", attachments=[]
            ),
            answer=AsyncMock(),
            edit=AsyncMock(),
        ),
    )


@pytest.mark.parametrize("after_house_choice", [False, True])
def test_last_issue_button_can_start_a_conversation_before_staff_reply(
    staff_api, after_house_choice
):
    from chatbot.handlers import user_handlers
    from maxapi.context import MemoryContext

    client, engine, _ = staff_api

    async def run():
        database = Database(client.app.state.database.engine.url)
        context, event = MemoryContext(91, 101), callback_event()
        try:
            await context.clear()
            with (
                patch.object(user_handlers, "session_factory", database.sessions),
            ):
                handler = (
                    user_handlers.process_my_issues_after_choice
                    if after_house_choice
                    else user_handlers.process_my_issues
                )
                await handler(event, context)
                markup = event.message.edit.await_args.kwargs["attachments"][0]
                assert markup.payload.buttons[0][0].url.endswith("?startapp=issue_1")
                assert markup.payload.buttons[0][0].text == "💬 Обращение и чат с УК"
                assert markup.payload.buttons[1][0].payload == "back_to_menu"
                assert markup.payload.buttons[2][0].web_app

        finally:
            await context.clear()
            await database.close()

    asyncio.run(run(), loop_factory=loop_factory)
    with Session(engine) as session:
        assert session.scalar(select(func.count()).select_from(StaffNotification)) == 0
        assert session.scalar(select(func.count()).select_from(IssueMessage)) == 0


def test_empty_issue_statistics_have_no_staff_reply_button(api):
    from chatbot.handlers import user_handlers
    from chatbot.lexicon.lexicon import LEXICON
    from maxapi.context import MemoryContext

    client, _, _ = api

    async def run():
        database = Database(client.app.state.database.engine.url)
        context, event = MemoryContext(92, 101), callback_event()
        try:
            await context.clear()
            with patch.object(user_handlers, "session_factory", database.sessions):
                await user_handlers.process_my_issues(event, context)
            message = event.message.edit.await_args.kwargs
            assert LEXICON["no_issues"] in message["text"]
            rows = message["attachments"][0].payload.buttons
            assert rows[0][0].payload == "back_to_menu"
            assert len(rows) == 2
        finally:
            await context.clear()
            await database.close()

    asyncio.run(run(), loop_factory=loop_factory)


def test_statistics_select_latest_own_nonrejected_issue_in_chosen_house(api):
    from chatbot.services.issue_information import get_issue_information

    client, engine, _ = api
    now = datetime.now(UTC)
    with Session(engine) as session:
        session.add(UserApartment(user_id=1, apartment_id=3))
        for issue_id, user_id, house_id in ((1, 1, 1), (2, 1, 1), (3, 1, 2), (4, 2, 1), (5, 1, 1)):
            session.add(
                Issue(
                    id=issue_id,
                    user_id=user_id,
                    house_id=house_id,
                    title=f"Обращение {issue_id}",
                    description=f"Описание {issue_id}",
                    category=IssueCategory.OTHER,
                    priority=IssuePriority.MEDIUM,
                    created_at=now + timedelta(seconds=issue_id),
                    rejected_at=now if issue_id == 5 else None,
                )
            )
        session.commit()

    async def run():
        database = Database(client.app.state.database.engine.url)
        try:
            async with database.sessions() as session:
                text, issue_id = await get_issue_information(session, 101, 1)
                assert issue_id == 2
                assert "Описание 2" in text
                assert all(f"Описание {i}" not in text for i in (1, 3, 4, 5))
                _, other_house_issue_id = await get_issue_information(session, 101, 2)
                assert other_house_issue_id == 3
        finally:
            await database.close()

    asyncio.run(run(), loop_factory=loop_factory)
