import unittest
import os
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from chatbot.handlers import user_handlers as handlers
from chatbot.states.states import FSMReport


class DraftContext:
    def __init__(self, **data):
        self.data = data
        self.state = None

    async def get_data(self):
        return dict(self.data)

    async def update_data(self, **data):
        self.data.update(data)

    async def set_state(self, state):
        self.state = state

    async def clear(self):
        self.data.clear()
        self.state = None


def event():
    return SimpleNamespace(
        callback=SimpleNamespace(payload="house_1", user=SimpleNamespace(user_id=101)),
        message=SimpleNamespace(
            body=SimpleNamespace(mid="prompt-1", text="Лампа не горит", attachments=[]),
            edit=AsyncMock(), answer=AsyncMock(),
        ),
        bot=SimpleNamespace(edit_message=AsyncMock()),
    )


class ReportFlowTests(unittest.IsolatedAsyncioTestCase):
    async def test_registration_never_allocates_random_apartments(self):
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
        from app.database.models import Base, Apartment, UserApartment
        from app.database.requests import create_user_if_exist

        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        try:
            async with engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            sessions = async_sessionmaker(engine)
            with patch.dict(os.environ, {"SAMPLE_DATA_ENABLED": "true"}):
                for user_id in (101, 102, 101):
                    async with sessions.begin() as session:
                        await create_user_if_exist(session, user_id, "Resident")
            async with sessions() as session:
                links = list(await session.scalars(select(UserApartment)))
                self.assertEqual(links, [])
        finally:
            await engine.dispose()

    async def test_house_choice_description_confirmation(self):
        context, update = DraftContext(), event()
        await handlers.process_start_report_after_choice(update, context)
        self.assertEqual(context.data["message_id"], "prompt-1")
        self.assertEqual(context.state, FSMReport.waiting)
        update.message.body.mid = "description-1"
        await handlers.process_get_report(update, context)
        self.assertEqual(context.state, FSMReport.confirm)
        update.bot.edit_message.assert_awaited_once_with(message_id="prompt-1", attachments=[])
        with patch.object(handlers, "submit_issue", new_callable=AsyncMock, return_value=42) as submit:
            await handlers.process_confirm_report(update, context, object(), object())
            self.assertEqual(submit.await_args.kwargs["description"], "Лампа не горит")
            self.assertEqual(submit.await_args.kwargs["house_id"], 1)
        self.assertEqual(context.data, {})

    async def test_old_draft_without_message_id_can_continue(self):
        context, update = DraftContext(house_id=1), event()
        await handlers.process_get_report(update, context)
        self.assertEqual(context.state, FSMReport.confirm)
        update.bot.edit_message.assert_not_awaited()

    async def test_deleted_prompt_does_not_drop_description(self):
        context, update = DraftContext(house_id=1, message_id="deleted"), event()
        update.bot.edit_message.side_effect = RuntimeError("deleted")
        await handlers.process_get_report(update, context)
        self.assertEqual(context.state, FSMReport.confirm)
        self.assertEqual(context.data["description"], "Лампа не горит")

    async def test_two_apartments_menu_uses_loaded_rows(self):
        context, update = DraftContext(), event()
        session = AsyncMock()
        factory = unittest.mock.MagicMock()
        factory.return_value.__aenter__ = AsyncMock(return_value=session)
        factory.return_value.__aexit__ = AsyncMock(return_value=False)
        with patch.object(handlers, "session_factory", factory), patch.object(
            handlers, "get_user_houses", new_callable=AsyncMock,
            return_value=[(1, "Дом", 7), (1, "Дом", 39)],
        ) as houses:
            await handlers.process_start_report(update, context)
            houses.assert_awaited_once()
        self.assertEqual(context.state, FSMReport.choose_house)


if __name__ == "__main__":
    unittest.main()
