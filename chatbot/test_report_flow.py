import asyncio
import os
import unittest
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

from maxapi.types.errors import Error

from app.ai.schemas import ReportAnalysis
from app.services.report_locations import ReportHome
from chatbot.handlers import user_handlers as handlers
from chatbot.services.report_screen import update_report_screen
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

    async def get_state(self):
        return self.state

    async def clear(self):
        self.data.clear()
        self.state = None


def event(*, created=False):
    return SimpleNamespace(
        from_user=SimpleNamespace(user_id=101),
        callback=None
        if created
        else SimpleNamespace(
            payload="house_1",
            user=SimpleNamespace(user_id=101),
            callback_id="callback-1",
        ),
        message=SimpleNamespace(
            body=SimpleNamespace(mid="prompt-1", text="Лампа не горит", attachments=[]),
            edit=AsyncMock(),
            answer=AsyncMock(
                return_value=SimpleNamespace(
                    message=SimpleNamespace(body=SimpleNamespace(mid="replacement-1"))
                )
            ),
        ),
        bot=SimpleNamespace(edit_message=AsyncMock(), send_callback=AsyncMock()),
    )


async def confirm_report(update, context, model, storage):
    update.callback.payload = (
        f"report_send_{context.data.get('report_confirmation_token')}"
    )
    await handlers.process_confirm_report(update, context, model, storage)


class ReportFlowTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.home = ReportHome(
            apartment_id=1,
            house_id=1,
            address="Дом",
            number=7,
            entrance=1,
            floor=1,
            entrances=2,
            floors=3,
        )
        factory = unittest.mock.MagicMock()
        factory.return_value.__aenter__ = AsyncMock(return_value=AsyncMock())
        factory.return_value.__aexit__ = AsyncMock(return_value=False)
        for name, value in (
            ("session_factory", factory),
            ("get_report_homes", AsyncMock(return_value=[self.home])),
        ):
            patched = patch.object(handlers, name, value)
            patched.start()
            self.addCleanup(patched.stop)
        self.model = self.analysis_model(scope="entrance", floor=1)

    def analysis_model(self, **changes):
        analysis = ReportAnalysis.model_validate(
            {
                "title": "Не горит лампа",
                "category": "electricity",
                "priority": 2,
                **changes,
            }
        )
        return SimpleNamespace(
            run=AsyncMock(
                return_value=[SimpleNamespace(text=analysis.model_dump_json())]
            )
        )

    async def test_registration_never_allocates_random_apartments(self):
        from sqlalchemy import select
        from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

        from app.database.models import Base, UserApartment
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
        await handlers.process_get_report(update, context, self.model)
        self.assertEqual(context.state, FSMReport.confirm)
        self.assertEqual(
            {
                call.kwargs["message_id"]
                for call in update.bot.edit_message.await_args_list
            },
            {"prompt-1"},
        )
        update.message.answer.assert_not_awaited()
        with patch.object(
            handlers, "submit_issue", new_callable=AsyncMock, return_value=42
        ) as submit:
            await confirm_report(update, context, object(), object())
            self.assertEqual(submit.await_args.kwargs["description"], "Лампа не горит")
            self.assertEqual(submit.await_args.kwargs["house_id"], 1)
            self.assertEqual(submit.await_args.kwargs["place"].entrance, 1)
            self.assertEqual(submit.await_args.kwargs["apartment_id"], 1)
        self.model.run.assert_awaited_once()
        self.assertEqual(context.data, {})

    async def test_old_draft_without_message_id_can_continue(self):
        context, update = DraftContext(house_id=1), event(created=True)
        await handlers.process_get_report(update, context, self.model)
        self.assertEqual(context.state, FSMReport.confirm)
        update.message.answer.assert_awaited_once()
        self.assertEqual(context.data["message_id"], "replacement-1")
        self.assertEqual(
            update.bot.edit_message.await_args.kwargs["message_id"], "replacement-1"
        )

    async def test_deleted_prompt_does_not_drop_description(self):
        context, update = DraftContext(house_id=1, message_id="deleted"), event()
        update.bot.edit_message.side_effect = [
            Error(code=404, raw={}),
            SimpleNamespace(success=True),
        ]
        await handlers.process_get_report(update, context, self.model)
        self.assertEqual(context.state, FSMReport.confirm)
        self.assertEqual(context.data["description"], "Лампа не горит")
        update.message.answer.assert_awaited_once()
        self.assertEqual(context.data["message_id"], "replacement-1")

    async def test_two_apartments_menu_uses_loaded_rows(self):
        context, update = DraftContext(), event()
        session = AsyncMock()
        factory = unittest.mock.MagicMock()
        factory.return_value.__aenter__ = AsyncMock(return_value=session)
        factory.return_value.__aexit__ = AsyncMock(return_value=False)
        with (
            patch.object(handlers, "session_factory", factory),
            patch.object(
                handlers,
                "get_report_homes",
                new_callable=AsyncMock,
                return_value=[
                    self.home,
                    self.home.model_copy(update={"apartment_id": 2, "number": 39}),
                ],
            ) as houses,
        ):
            await handlers.process_start_report(update, context)
            houses.assert_awaited_once()
        self.assertEqual(context.state, FSMReport.choose_house)
        buttons = update.bot.edit_message.await_args.kwargs["attachments"][
            0
        ].payload.buttons
        self.assertEqual(
            [buttons[0][0].payload, buttons[1][0].payload],
            ["report_home_1", "report_home_2"],
        )

    async def test_unknown_place_requires_selection_and_private_preview_names_audience(
        self,
    ):
        context, update = DraftContext(house_id=1), event()
        model = self.analysis_model()
        await handlers.process_get_report(update, context, model)
        self.assertEqual(context.state, FSMReport.choose_scope)
        update.callback.payload = "report_scope_apartment"
        await handlers.process_report_scope(update, context)
        self.assertEqual(context.state, FSMReport.confirm)
        self.assertEqual(context.data["report_place"]["apartment_id"], 1)
        preview = update.bot.edit_message.await_args.kwargs["text"]
        self.assertIn("только вы", preview)
        self.assertIn("Квартира 7", preview)
        model.run.assert_awaited_once()

    async def test_unknown_floor_is_asked_and_out_of_range_input_preserves_photos(self):
        photos = [{"id": "p", "url": "https://example.test/p.png"}]
        context, update = DraftContext(house_id=1, photos=photos), event()
        await handlers.process_get_report(
            update, context, self.analysis_model(scope="entrance")
        )
        self.assertEqual(context.state, FSMReport.choose_floor)
        update.message.body.text = "99"
        await handlers.process_report_floor(update, context)
        self.assertEqual(context.state, FSMReport.choose_floor)
        self.assertEqual(context.data["photos"], photos)
        update.message.body.text = "2"
        await handlers.process_report_floor(update, context)
        self.assertEqual(context.state, FSMReport.confirm)
        self.assertIn("этаж 2", update.bot.edit_message.await_args.kwargs["text"])
        update.message.answer.assert_not_awaited()

    async def test_manual_scope_change_clears_old_coordinates_and_limits_categories(
        self,
    ):
        context, update = DraftContext(house_id=1), event()
        await handlers.process_get_report(update, context, self.model)
        await handlers.process_edit_report_place(update, context)
        update.callback.payload = "report_scope_courtyard"
        await handlers.process_report_scope(update, context)
        self.assertIsNone(context.data["report_place"]["floor"])
        self.assertIsNone(context.data["report_place"]["entrance"])
        self.assertIn(
            "всех подъездов", update.bot.edit_message.await_args.kwargs["text"]
        )
        await handlers.process_edit_report_category(update, context)
        buttons = update.bot.edit_message.await_args.kwargs["attachments"][
            0
        ].payload.buttons
        codes = {button.payload for row in buttons for button in row}
        self.assertNotIn("report_category_elevator", codes)
        self.assertNotIn("report_category_heating", codes)
        update.callback.payload = "report_category_elevator"
        await handlers.process_report_category(update, context)
        self.assertEqual(context.state, FSMReport.choose_category)
        update.callback.payload = "report_category_garbage"
        await handlers.process_report_category(update, context)
        self.assertEqual(context.state, FSMReport.confirm)
        self.assertEqual(context.data["report_analysis"]["category"], "garbage")
        update.message.answer.assert_not_awaited()

    async def test_model_failure_can_be_completed_manually_without_second_ai_call(self):
        context, update = DraftContext(house_id=1), event()
        model = SimpleNamespace(run=AsyncMock(side_effect=TimeoutError()))
        await handlers.process_get_report(update, context, model)
        self.assertEqual(context.state, FSMReport.choose_scope)
        update.callback.payload = "report_scope_courtyard"
        await handlers.process_report_scope(update, context)
        with patch.object(
            handlers, "submit_issue", AsyncMock(return_value=42)
        ) as submit:
            await confirm_report(update, context, model, object())
            self.assertEqual(
                submit.await_args.kwargs["analysis"].title, "Обращение жителя"
            )
        model.run.assert_awaited_once()

    async def test_cancelled_analysis_cannot_restore_a_cleared_draft(self):
        context, update = DraftContext(house_id=1), event()

        async def cancelled(*args, **kwargs):
            await context.clear()
            return ReportAnalysis(title="Черновик", category="other", priority=2)

        with patch.object(handlers, "analyze_report", side_effect=cancelled):
            await handlers.process_get_report(update, context, self.model)
        self.assertEqual(context.data, {})
        self.assertIsNone(context.state)

    async def test_database_retry_preserves_preview_and_does_not_repeat_analysis(self):
        context, update = DraftContext(house_id=1), event()
        await handlers.process_get_report(update, context, self.model)
        with patch.object(
            handlers, "submit_issue", AsyncMock(side_effect=[RuntimeError(), 42])
        ) as submit:
            await confirm_report(update, context, self.model, object())
            self.assertEqual(context.state, FSMReport.confirm)
            self.assertIn("report_analysis", context.data)
            await confirm_report(update, context, self.model, object())
            self.assertEqual(submit.await_count, 2)
        self.model.run.assert_awaited_once()
        self.assertEqual(context.data, {})
        update.message.answer.assert_not_awaited()

    async def test_repeating_the_same_step_does_not_edit_or_send_again(self):
        context, update = DraftContext(house_id=1), event()
        await handlers.process_get_report(update, context, self.model)
        await handlers.process_edit_report_place(update, context)
        count = update.bot.edit_message.await_count
        await handlers.process_edit_report_place(update, context)
        self.assertEqual(update.bot.edit_message.await_count, count)
        update.message.answer.assert_not_awaited()

    async def test_temporary_edit_failure_keeps_the_draft_without_a_duplicate(self):
        context, update = (
            DraftContext(house_id=1, message_id="prompt-1", description="Текст"),
            event(),
        )
        update.bot.edit_message.return_value = Error(code=500, raw={})
        with self.assertRaises(RuntimeError):
            await update_report_screen(update, context, "Новый экран")
        self.assertEqual(context.data["description"], "Текст")
        self.assertEqual(context.data["message_id"], "prompt-1")
        update.message.answer.assert_not_awaited()

    async def test_photos_then_description_keep_the_same_message(self):
        context, update = (
            DraftContext(house_id=1, message_id="prompt-1"),
            event(created=True),
        )
        update.message.body.mid = "photo-1"
        update.message.body.text = None
        update.message.body.attachments = [
            SimpleNamespace(
                type="image",
                payload=SimpleNamespace(url="https://example.test/p.png", photo_id="p"),
            )
        ]
        await handlers.process_get_report(update, context, self.model)
        self.assertEqual(context.state, FSMReport.get_description)
        update.message.body.mid = "description-1"
        update.message.body.text = "Лампа не горит"
        update.message.body.attachments = []
        await handlers.process_get_description(update, context, self.model)
        self.assertEqual(context.state, FSMReport.confirm)
        self.assertEqual(context.data["photos"][0]["id"], "p")
        self.assertEqual(
            {
                call.kwargs["message_id"]
                for call in update.bot.edit_message.await_args_list
            },
            {"prompt-1"},
        )
        update.message.answer.assert_not_awaited()

    async def test_double_confirmation_saves_only_once(self):
        context, update = DraftContext(house_id=1), event()
        await handlers.process_get_report(update, context, self.model)
        started, finish = asyncio.Event(), asyncio.Event()

        async def save(**kwargs):
            started.set()
            await finish.wait()
            return 42

        with patch.object(handlers, "submit_issue", side_effect=save) as submit:
            first = asyncio.create_task(
                confirm_report(update, context, self.model, object())
            )
            await started.wait()
            await confirm_report(update, context, self.model, object())
            finish.set()
            await first
            submit.assert_awaited_once()

    async def test_finishing_submission_does_not_clear_a_newer_draft(self):
        context, update = DraftContext(house_id=1), event()
        await handlers.process_get_report(update, context, self.model)

        async def save(**kwargs):
            await context.clear()
            await context.update_data(
                description="Новое обращение", report_analysis_token="new"
            )
            await context.set_state(FSMReport.waiting)
            return 42

        with patch.object(handlers, "submit_issue", side_effect=save):
            await confirm_report(update, context, self.model, object())
        self.assertEqual(context.data["description"], "Новое обращение")
        self.assertEqual(context.state, FSMReport.waiting)


if __name__ == "__main__":
    unittest.main()
