"""Resident registration, backed by the same database service as the mini-app."""

import logging

from app.config_data.config import read_environment
from app.database.models import User
from app.database.requests import create_user_if_exist
from app.database.session import session_factory
from app.services.registration import (
    TEST_NOTICE,
    WELCOME,
    catalog,
    normalize_name,
    registration_state,
    submit_registration,
)
from maxapi import F, Router
from maxapi.context import MemoryContext
from maxapi.types import CallbackButton, MessageCallback, MessageCreated
from maxapi.types.errors import Error
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from chatbot.keyboards.inline import inl_menu, mini_app_button
from chatbot.lexicon.lexicon import LEXICON
from chatbot.states.states import FSMRegistration

router = Router()
logger = logging.getLogger(__name__)


async def clear_keep_prompt(context):
    data = await context.get_data()
    await context.clear()
    if data.get("registration_message_id"):
        await context.update_data(registration_message_id=data["registration_message_id"])


async def show_prompt(event, context, text, attachments=None):
    data = await context.get_data()
    message_id = data.get("registration_message_id")
    if message_id:
        try:
            result = await event.bot.edit_message(
                message_id=message_id, text=text, attachments=attachments or []
            )
            if not isinstance(result, Error):
                return
        except Exception as error:
            logger.warning("Registration prompt could not be edited: %s", type(error).__name__)
    sent = await event.message.answer(text, attachments=attachments or [])
    # SDK versions may return Message directly or a response containing Message.
    body = getattr(sent, "body", None) or getattr(getattr(sent, "message", None), "body", None)
    if body is not None and isinstance(getattr(body, "mid", None), str):
        await context.update_data(registration_message_id=body.mid)


async def finish_registration(event, context):
    await show_prompt(
        event,
        context,
        "🎉 Добро пожаловать в ДомПульс!\n\n🔑 Квартира привязана. "
        "Теперь можно сообщать о проблемах и следить за жизнью дома.\n\n"
        "📱 Откройте мини-приложение — там вас ждёт короткое обучение.",
    )
    await context.clear()
    await event.message.answer(
        "🏠 Главное меню\n\nВыберите нужный раздел 👇", attachments=[inl_menu()]
    )


def test_mode():
    return read_environment().bool("ONBOARDING_TEST_MODE", False)


def keyboard(*rows):
    builder = InlineKeyboardBuilder()
    for row in rows:
        builder.row(*(CallbackButton(text=text, payload=payload) for text, payload in row))
    builder.row(mini_app_button())
    return builder.as_markup()


def welcome_prompt(state):
    if state["complete"]:
        return LEXICON["bot_start"], inl_menu()
    if state["status"] == "pending":
        return (
            "Ваша заявка передана в УК. После принятия квартира появится "
            "здесь и в мини-приложении.",
            keyboard([("Проверить статус", "reg:start")]),
        )
    text = WELCOME
    if state["status"] == "rejected":
        text += "\n\nПредыдущая заявка отклонена. Проверьте данные и отправьте новую."
    if test_mode():
        text += "\n\n" + TEST_NOTICE
    return text, keyboard([("Оставить заявку в УК", "reg:start")])


async def initial_prompt(max_id, name):
    async with session_factory.begin() as session:
        await create_user_if_exist(session, max_id, name)
        user = await session.scalar(select(User).where(User.max_user_id == max_id))
        return welcome_prompt(await registration_state(session, user.id))


async def current(session, max_id):
    user = await session.scalar(select(User).where(User.max_user_id == max_id))
    if user is None:
        raise ValueError("Нажмите /start, чтобы начать регистрацию")
    return user, await registration_state(session, user.id)


async def company_prompt(event, context):
    async with session_factory() as session:
        companies = await catalog(session)
    if not companies:
        await show_prompt(
            event,
            context,
            "Зарегистрированных УК пока нет. Обратитесь в свою УК или проверьте позже.",
            attachments=[keyboard([("Повторить", "reg:start")])],
        )
        return
    await show_prompt(
        event,
        context,
        "🏢 Выберите управляющую компанию:",
        attachments=[
            keyboard(
                *[[(company["name"], f"reg:company:{company['id']}")] for company in companies]
            )
        ],
    )


@router.message_callback(F.callback.payload.startswith("reg:"))
async def registration_callback(event: MessageCallback, context: MemoryContext):
    try:
        async with session_factory() as session:
            _user, state = await current(session, event.callback.user.user_id)
        if state["complete"] or state["status"] == "pending":
            await context.update_data(registration_message_id=event.message.body.mid)
            if state["complete"]:
                await finish_registration(event, context)
                return
            text, buttons = welcome_prompt(state)
            await show_prompt(event, context, text, attachments=[buttons])
            return
        action = event.callback.payload
        if action == "reg:start":
            await context.clear()
            await context.update_data(registration_message_id=event.message.body.mid)
            await show_prompt(
                event,
                context,
                f"👤 Проверьте ФИО из вашего профиля:\n{state['name']}\n\n"
                "Если нужно, исправьте его — это имя увидит УК.",
                attachments=[
                    keyboard(
                        [
                            ("Всё верно", "reg:name:keep"),
                            ("Изменить ФИО", "reg:name:edit"),
                        ]
                    )
                ],
            )
        elif action == "reg:name:edit":
            await context.set_state(FSMRegistration.name)
            await show_prompt(event, context, "✍️ Напишите ваши фамилию, имя и отчество:")
        elif action == "reg:name:keep":
            await clear_keep_prompt(context)
            await context.update_data(full_name=normalize_name(state["name"]))
            await company_prompt(event, context)
        elif action.startswith("reg:company:"):
            company_id = int(action.rsplit(":", 1)[1])
            data = await context.get_data()
            if not data.get("full_name"):
                raise ValueError("Начните заявку заново: нажмите /start")
            async with session_factory() as session:
                company = next((c for c in await catalog(session) if c["id"] == company_id), None)
            if company is None:
                raise ValueError("УК не найдена. Нажмите /start")
            await context.update_data(company_id=company_id)
            # Five short address rows keep the selection compact on a mobile screen.
            await show_prompt(
                event,
                context,
                "📍 Выберите адрес проживания — " + company["name"] + ":",
                attachments=[
                    keyboard(*[[(h["address"], f"reg:house:{h['id']}")] for h in company["houses"]])
                ],
            )
        elif action.startswith("reg:house:"):
            house_id = int(action.rsplit(":", 1)[1])
            data = await context.get_data()
            async with session_factory() as session:
                company = next(
                    (c for c in await catalog(session) if c["id"] == data.get("company_id")),
                    None,
                )
            house = (
                next((h for h in company["houses"] if h["id"] == house_id), None)
                if company
                else None
            )
            if house is None:
                raise ValueError("Выберите УК заново: нажмите /start")
            await context.update_data(house_id=house_id)
            await context.set_state(FSMRegistration.apartment)
            await show_prompt(
                event,
                context,
                f"{house['address']} · {house['floors']} этажей\n"
                f"Введите номер квартиры (1–{house['apartments_count']}):",
            )
    except ValueError as error:
        await event.message.answer(str(error))
    except SQLAlchemyError:
        await show_prompt(
            event,
            context,
            "Не удалось обратиться к базе данных. Повторите действие через несколько секунд.",
        )


@router.message_created(FSMRegistration.name)
async def registration_name(event: MessageCreated, context: MemoryContext):
    try:
        name = normalize_name(event.message.body.text or "")
        async with session_factory.begin() as session:
            user, state = await current(session, event.from_user.user_id)
            if state["complete"] or state["status"] == "pending":
                await context.clear()
                text, buttons = welcome_prompt(state)
                await event.message.answer(text, attachments=[buttons])
                return
            user.name = name
        await clear_keep_prompt(context)
        await context.update_data(full_name=name)
        await company_prompt(event, context)
    except ValueError as error:
        await event.message.answer(str(error))
    except SQLAlchemyError:
        await event.message.answer(
            "Не удалось обратиться к базе данных. Повторите действие через несколько секунд."
        )


@router.message_created(FSMRegistration.apartment)
async def registration_apartment(event: MessageCreated, context: MemoryContext):
    data = await context.get_data()
    try:
        async with session_factory.begin() as session:
            user, state = await current(session, event.from_user.user_id)
            if not state["complete"] and state["status"] != "pending":
                raw = (event.message.body.text or "").strip()
                if not raw.isascii() or not raw.isdigit() or len(raw) > 6:
                    raise ValueError("Введите номер квартиры цифрами")
                if not all(key in data for key in ("full_name", "company_id", "house_id")):
                    raise ValueError("Начните заявку заново: нажмите /start")
                state = await submit_registration(
                    session,
                    user.id,
                    full_name=data["full_name"],
                    company_id=data["company_id"],
                    house_id=data["house_id"],
                    apartment_number=int(raw),
                    source="bot",
                    auto_approve=test_mode(),
                )
        if state["complete"]:
            await finish_registration(event, context)
        else:
            text, buttons = welcome_prompt(state)
            await show_prompt(event, context, text, attachments=[buttons])
            await context.clear()
    except ValueError as error:
        await event.message.answer(str(error))
    except SQLAlchemyError:
        await event.message.answer(
            "Не удалось обратиться к базе данных. Повторите действие через несколько секунд."
        )
