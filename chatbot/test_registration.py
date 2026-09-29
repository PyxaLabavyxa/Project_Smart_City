import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from app.database.models import Base, RegistrationRequest, User
from app.database.registration_demo import seed_registration_demo
from app.services.registration import catalog, submit_registration
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from chatbot.handlers import registration as handlers
from chatbot.test_report_flow import DraftContext


class RegistrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.sessions.begin() as session:
            await seed_registration_demo(session)
            session.add(User(max_user_id=100, name="Иван Петров"))
        self.session_patch = patch.object(handlers, "session_factory", self.sessions)
        self.mode_patch = patch.object(handlers, "test_mode", return_value=True)
        self.session_patch.start()
        self.mode_patch.start()

    async def asyncTearDown(self):
        self.session_patch.stop()
        self.mode_patch.stop()
        await self.engine.dispose()

    def event(self, payload="reg:start", text=""):
        return SimpleNamespace(
            callback=SimpleNamespace(payload=payload, user=SimpleNamespace(user_id=100)),
            from_user=SimpleNamespace(user_id=100),
            bot=SimpleNamespace(edit_message=AsyncMock()),
            message=SimpleNamespace(
                body=SimpleNamespace(text=text, mid="registration-prompt"), answer=AsyncMock()
            ),
        )

    async def test_complete_flow_with_edited_name_and_invalid_apartment(self):
        context = DraftContext()
        for payload in ("reg:start", "reg:name:edit"):
            await handlers.registration_callback(self.event(payload), context)
        await handlers.registration_name(self.event(text="Петров Иван Сергеевич"), context)
        self.assertEqual(context.data["full_name"], "Петров Иван Сергеевич")
        await handlers.registration_callback(self.event("reg:company:1"), context)
        await handlers.registration_callback(self.event("reg:house:1"), context)
        invalid = self.event(text="99999")
        await handlers.registration_apartment(invalid, context)
        self.assertIn("Такой квартиры", invalid.message.answer.call_args.args[0])
        submitted = self.event(text="12")
        await handlers.registration_apartment(submitted, context)
        submitted.bot.edit_message.assert_awaited_once()
        self.assertEqual(
            submitted.bot.edit_message.call_args.kwargs["message_id"], "registration-prompt"
        )
        self.assertIn("Добро пожаловать", submitted.bot.edit_message.call_args.kwargs["text"])
        self.assertIn("Главное меню", submitted.message.answer.call_args.args[0])
        self.assertEqual(context.data, {})
        text, _ = await handlers.initial_prompt(100, "Имя MAX")
        self.assertNotIn("не назначены", text)
        async with self.sessions() as session:
            self.assertEqual(
                await session.scalar(select(func.count()).select_from(RegistrationRequest)),
                1,
            )
            user = await session.scalar(select(User).where(User.max_user_id == 100))
            self.assertEqual(user.name, "Петров Иван Сергеевич")

    async def test_mini_app_completion_ignores_stale_bot_form(self):
        context = DraftContext(full_name="Старое имя", company_id=1, house_id=1)
        async with self.sessions.begin() as session:
            user = await session.scalar(select(User).where(User.max_user_id == 100))
            company = (await catalog(session))[0]
            await submit_registration(
                session,
                user.id,
                full_name="Новое имя",
                company_id=company["id"],
                house_id=company["houses"][0]["id"],
                apartment_number=8,
                source="mini_app",
                auto_approve=True,
            )
        await handlers.registration_apartment(self.event(text="20"), context)
        async with self.sessions() as session:
            self.assertEqual(
                await session.scalar(select(func.count()).select_from(RegistrationRequest)),
                1,
            )
            user = await session.scalar(select(User).where(User.max_user_id == 100))
            self.assertEqual(user.name, "Новое имя")
