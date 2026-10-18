"""Ссылки вместо ответов в боте для кнопок из старых уведомлений."""

from maxapi import F, Router
from maxapi.types import MessageCallback

from chatbot.keyboards.inline import inl_back_to_menu
from chatbot.middlewares.registration import RegistrationRequiredMiddleware

router = Router()
router.middlewares.append(RegistrationRequiredMiddleware())


@router.message_callback(F.callback.payload.regexp(r"^staff_reply_[0-9]+$"))
async def start_reply(event: MessageCallback):
    issue_id = int(event.callback.payload.removeprefix("staff_reply_"))
    await event.message.answer(
        "💬 Переписка с УК теперь в мини-приложении.\n"
        "Откройте обращение: там сохранена история и можно задать вопрос сотруднику.",
        attachments=[inl_back_to_menu(issue_id=issue_id)],
    )


@router.message_callback(F.callback.payload == "staff_reply_cancel")
async def cancel_reply(event: MessageCallback):
    await event.message.answer(
        "Переписка с УК перенесена в карточку обращения мини-приложения.",
        attachments=[inl_back_to_menu()],
    )
