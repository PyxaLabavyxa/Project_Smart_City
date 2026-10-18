import logging

from maxapi.filters.middleware import BaseMiddleware
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError

from app.database.models import User
from app.database.session import session_factory
from app.services.registration import registration_state
from chatbot.handlers.registration import welcome_prompt

logger = logging.getLogger(__name__)


class RegistrationRequiredMiddleware(BaseMiddleware):
    async def __call__(self, handler, event_object, data):
        user = (
            event_object.callback.user
            if event_object.update_type == "message_callback"
            else event_object.from_user
        )
        try:
            async with session_factory() as session:
                resident = await session.scalar(select(User).where(User.max_user_id == user.user_id))
                state = await registration_state(session, resident.id) if resident else None
        except SQLAlchemyError as error:
            logger.warning("Registration check failed: %s", type(error).__name__)
            await event_object.message.answer(
                "Не удалось проверить регистрацию. Попробуйте ещё раз через несколько секунд."
            )
            return

        if state is not None and state["complete"]:
            return await handler(event_object, data)

        if state is None:
            await event_object.message.answer(
                "🔐 Чтобы пользоваться Домоведом, сначала зарегистрируйтесь и привяжите квартиру. "
                "Отправьте /start, чтобы начать регистрацию."
            )
            return

        text, buttons = welcome_prompt(state)
        if state["status"] != "pending":
            text = (
                "🔐 Чтобы пользоваться Домоведом, сначала зарегистрируйтесь и привяжите квартиру.\n\n"
                "Нажмите «Оставить заявку в УК» ниже."
            )
            if state["status"] == "rejected":
                text += "\n\nПредыдущая заявка отклонена. Проверьте данные и отправьте новую."
        await event_object.message.answer(text, attachments=[buttons])
