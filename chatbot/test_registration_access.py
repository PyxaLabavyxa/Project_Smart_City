import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from maxapi import Dispatcher
from sqlalchemy import delete, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.database.models import (
    Apartment, Base, CompanyHouse, House, ManagementCompany, RegistrationRequest, User, UserApartment,
)
from chatbot.handlers import other_handlers, registration, staff_messages, user_handlers
from chatbot.lexicon.lexicon import LEXICON
from chatbot.middlewares import registration as access
from chatbot.states.states import FSMRegistration, FSMReport


class RegistrationAccessTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        async with self.engine.begin() as connection:
            await connection.run_sync(Base.metadata.create_all)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        async with self.sessions.begin() as session:
            company = ManagementCompany(name="Тестовая УК")
            house = House(
                address="г. Казань, ул. Тестовая, 1",
                entrances_count=1, floors_count=3, apartments_per_floor=4,
            )
            resident = User(max_user_id=100, name="Иван Петров")
            session.add_all([company, house, resident])
            await session.flush()
            self.user_id = resident.id
            session.add(CompanyHouse(company_id=company.id, house_id=house.id))
            session.add_all(
                Apartment(house_id=house.id, number=number, entrance=1, floor=(number - 1) // 4 + 1)
                for number in range(1, 13)
            )
        for module in (access, registration, user_handlers):
            mocked = patch.object(module, "session_factory", self.sessions)
            mocked.start()
            self.addCleanup(mocked.stop)
        mocked_mode = patch.object(registration, "test_mode", return_value=True)
        mocked_mode.start()
        self.addCleanup(mocked_mode.stop)
        self.dispatcher = Dispatcher()
        self.dispatcher.include_routers(
            user_handlers.start_router,
            user_handlers.router,
            registration.router,
            staff_messages.router,
            other_handlers.router,
        )

    async def asyncTearDown(self):
        await self.engine.dispose()

    def event(self, text="привет", payload=None, max_id=100):
        user = SimpleNamespace(user_id=max_id, full_name="Иван Петров")
        return SimpleNamespace(
            update_type="message_callback" if payload is not None else "message_created",
            get_ids=lambda: (max_id, max_id),
            callback=SimpleNamespace(payload=payload, user=user) if payload is not None else None,
            from_user=user,
            bot=SimpleNamespace(edit_message=AsyncMock()),
            message=SimpleNamespace(
                body=SimpleNamespace(text=text, mid="registration-prompt", attachments=[]),
                answer=AsyncMock(),
                edit=AsyncMock(),
            ),
        )

    def payloads(self, response):
        return {
            button.get("payload")
            for attachment in response.kwargs.get("attachments", [])
            for row in attachment.model_dump(mode="json")["payload"]["buttons"]
            for button in row
            if button.get("payload") is not None
        }

    def assert_registration_prompt(self, event):
        event.message.answer.assert_awaited_once()
        response = event.message.answer.call_args
        self.assertEqual(self.payloads(response), {"reg:start"})
        event.message.edit.assert_not_awaited()
        return response.args[0] if response.args else response.kwargs["text"]

    async def link_apartment(self):
        async with self.sessions.begin() as session:
            session.add(UserApartment(user_id=self.user_id, apartment_id=1))

    async def test_arbitrary_messages_cannot_open_menu(self):
        for text in ("Жопа АХахахах", "привет", "/unknown", ""):
            with self.subTest(text=text):
                event = self.event(text=text)
                await self.dispatcher.handle(event)
                self.assertIn("сначала зарегистрируйтесь", self.assert_registration_prompt(event))

    async def test_help_and_old_buttons_require_registration(self):
        events = [self.event(text="/help")]
        events.extend(
            self.event(payload=payload)
            for payload in ("back_to_menu", "send_report", "my_issues", "staff_reply_1")
        )
        for event in events:
            with self.subTest(payload=event.callback.payload if event.callback else "/help"):
                await self.dispatcher.handle(event)
                self.assert_registration_prompt(event)

    async def test_bot_started_keeps_registration_available(self):
        event = self.event()
        event.update_type = "bot_started"
        event.chat_id = 100
        event.bot.send_message = AsyncMock()
        await self.dispatcher.handle(event)
        event.bot.send_message.assert_awaited_once()
        self.assertEqual(self.payloads(event.bot.send_message.call_args), {"reg:start"})

    async def test_pending_and_rejected_applications_do_not_unlock_menu(self):
        for status in ("pending", "rejected"):
            with self.subTest(status=status):
                async with self.sessions.begin() as session:
                    await session.execute(delete(RegistrationRequest))
                    session.add(RegistrationRequest(
                        user_id=self.user_id, company_id=1, apartment_id=1,
                        full_name="Иван Петров", source="bot", status=status,
                    ))
                event = self.event()
                await self.dispatcher.handle(event)
                text = self.assert_registration_prompt(event)
                self.assertIn("передана в УК" if status == "pending" else "отклонена", text)

    async def test_registered_resident_keeps_existing_menu_and_help(self):
        await self.link_apartment()
        for text, expected in (("привет", LEXICON["unknown_message"]), ("/help", LEXICON["help"])):
            with self.subTest(text=text):
                event = self.event(text=text)
                await self.dispatcher.handle(event)
                event.message.answer.assert_awaited_once()
                response = event.message.answer.call_args
                self.assertEqual(response.args[0] if response.args else response.kwargs["text"], expected)
                self.assertEqual(self.payloads(response), {"send_report", "my_issues"})
        event = self.event(payload="back_to_menu")
        await self.dispatcher.handle(event)
        event.message.edit.assert_awaited_once()

    async def test_start_and_registration_flow_still_work(self):
        start = self.event(text="/start")
        await self.dispatcher.handle(start)
        self.assert_registration_prompt(start)
        for payload in ("reg:start", "reg:name:edit"):
            await self.dispatcher.handle(self.event(payload=payload))
        context = self.dispatcher.contexts[0]
        self.assertEqual(await context.get_state(), FSMRegistration.name)
        blocked = self.event(payload="back_to_menu")
        await self.dispatcher.handle(blocked)
        self.assert_registration_prompt(blocked)
        self.assertEqual(await context.get_state(), FSMRegistration.name)
        await self.dispatcher.handle(self.event(text="Петров Иван Сергеевич"))
        for payload in ("reg:company:1", "reg:house:1"):
            await self.dispatcher.handle(self.event(payload=payload))
        self.assertEqual(await context.get_state(), FSMRegistration.apartment)
        invalid = self.event(text="не номер")
        await self.dispatcher.handle(invalid)
        self.assertIn("номер квартиры цифрами", invalid.message.answer.call_args.args[0])
        await self.dispatcher.handle(self.event(text="12"))
        async with self.sessions() as session:
            link = await session.scalar(select(UserApartment).where(UserApartment.user_id == self.user_id))
            self.assertIsNotNone(link)
        event = self.event()
        await self.dispatcher.handle(event)
        self.assertEqual(self.payloads(event.message.answer.call_args), {"send_report", "my_issues"})

    async def test_lost_apartment_blocks_stale_report_state(self):
        await self.link_apartment()
        await self.dispatcher.handle(self.event(payload="send_report"))
        context = self.dispatcher.contexts[0]
        self.assertEqual(await context.get_state(), FSMReport.waiting)
        async with self.sessions.begin() as session:
            await session.execute(delete(UserApartment).where(UserApartment.user_id == self.user_id))
        event = self.event(text="Не работает лифт")
        await self.dispatcher.handle(event)
        self.assert_registration_prompt(event)
        event.bot.edit_message.assert_not_awaited()

    async def test_unknown_user_is_sent_to_start(self):
        event = self.event(max_id=999)
        await self.dispatcher.handle(event)
        event.message.answer.assert_awaited_once()
        self.assertIn("/start", event.message.answer.call_args.args[0])
        self.assertEqual(self.payloads(event.message.answer.call_args), set())

    async def test_database_failure_does_not_unlock_menu(self):
        event = self.event()
        with patch.object(access, "session_factory", side_effect=SQLAlchemyError("unavailable")):
            await self.dispatcher.handle(event)
        event.message.answer.assert_awaited_once()
        self.assertIn("Не удалось проверить регистрацию", event.message.answer.call_args.args[0])
        self.assertEqual(self.payloads(event.message.answer.call_args), set())


if __name__ == "__main__":
    unittest.main()
