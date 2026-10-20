"""Remember genuine private bot interactions, independently of mini-app visits."""

import logging

from app.database.models import User
from app.database.session import session_factory
from maxapi import Router
from maxapi.filters.middleware import BaseMiddleware
from sqlalchemy import update

router = Router()
logger = logging.getLogger(__name__)


async def record_dialog(max_id, active, sessions=session_factory):
    async with sessions.begin() as session:
        await session.execute(
            update(User).where(User.max_user_id == max_id).values(bot_dialog_started=active)
        )


class PrivateDialogMiddleware(BaseMiddleware):
    async def __call__(self, handler, event, data):
        recipient = getattr(getattr(event, "message", None), "recipient", None)
        kind = getattr(event, "update_type", "")
        started = getattr(kind, "value", kind) == "bot_started"
        private = (
            recipient and getattr(recipient.chat_type, "value", recipient.chat_type) == "dialog"
        )
        user = getattr(event, "from_user", None) or getattr(event, "user", None)
        result = await handler(event, data)
        if (started or private) and user and not getattr(user, "is_bot", False):
            try:
                await record_dialog(user.user_id, True)
            except Exception as error:
                logger.warning("Could not record private bot interaction: %s", type(error).__name__)
        return result


@router.bot_stopped()
async def stopped(event):
    await record_dialog(event.user.user_id, False)
