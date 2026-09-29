import logging

from maxapi import F, Router
from maxapi.context import MemoryContext
from maxapi.types import CallbackButton, MessageCallback, MessageCreated
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder

from app.database.session import session_factory
from chatbot.keyboards.inline import inl_mini_app, mini_app_button
from chatbot.services.staff_messages import reply_issue, save_reply
from chatbot.states.states import FSMStaffReply

router = Router()
logger = logging.getLogger(__name__)


def cancel_keyboard():
    builder = InlineKeyboardBuilder()
    builder.add(CallbackButton(text="↩️ Отменить ответ", payload="staff_reply_cancel"))
    builder.row(mini_app_button())
    return builder.as_markup()


async def restore_context(context: MemoryContext, data: dict) -> None:
    await context.clear()
    await context.update_data(**data.get("staff_previous_data", {}))
    await context.set_state(data.get("staff_previous_state"))


@router.message_callback(FSMStaffReply.waiting, F.callback.payload == "staff_reply_cancel")
async def cancel_reply(event: MessageCallback, context: MemoryContext):
    await restore_context(context, await context.get_data())
    await event.message.edit(
        text="Ответ отменён. Можно продолжить предыдущий диалог.", attachments=[inl_mini_app()]
    )


@router.message_callback(F.callback.payload.regexp(r"^staff_reply_[0-9]+$"))
async def start_reply(event: MessageCallback, context: MemoryContext):
    issue_id = int(event.callback.payload.removeprefix("staff_reply_"))
    async with session_factory() as session:
        issue = await reply_issue(session, event.callback.user.user_id, issue_id)
        if issue is None:
            await event.message.answer(
                "Обращение недоступно. Выберите уведомление по своей заявке.",
                attachments=[inl_mini_app()],
            )
            return
        title = issue.title
    state, data = await context.get_state(), dict(await context.get_data())
    if state == FSMStaffReply.waiting:
        previous_state = data.get("staff_previous_state")
        previous_data = data.get("staff_previous_data", {})
    else:
        previous_state, previous_data = state, data
    await context.clear()
    await context.update_data(
        staff_issue_id=issue_id,
        staff_previous_state=previous_state,
        staff_previous_data=previous_data,
    )
    await context.set_state(FSMStaffReply.waiting)
    await event.message.answer(
        f"💬 Ответ по обращению №{issue_id}\n{title}\n\n"
        "Напишите сообщение сотруднику — до 1500 символов. Здесь принимается только текст. "
        "Ваш черновик другого обращения сохранён.",
        attachments=[cancel_keyboard()],
    )


@router.message_created(FSMStaffReply.waiting)
async def receive_reply(event: MessageCreated, context: MemoryContext):
    data = dict(await context.get_data())
    text = (event.message.body.text or "").strip()
    if event.message.body.attachments:
        await event.message.answer(
            "В ответе сотруднику пока поддерживается только текст без вложений."
        )
        return
    try:
        await save_reply(
            session_factory,
            event.from_user.user_id,
            data["staff_issue_id"],
            text,
            str(event.message.body.mid),
        )
    except ValueError as exc:
        await event.message.answer(str(exc))
        return
    except Exception as exc:
        logger.error("Could not save staff reply: %s", type(exc).__name__)
        await event.message.answer("Не удалось сохранить ответ. Попробуйте отправить его ещё раз.")
        return
    await restore_context(context, data)
    await event.message.answer(
        f"✅ Ответ по обращению №{data['staff_issue_id']} передан в кабинет сотрудника.\n"
        "Можно продолжить предыдущий диалог.",
        attachments=[inl_mini_app()],
    )
