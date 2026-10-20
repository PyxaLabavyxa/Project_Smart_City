import logging
import re
from datetime import UTC, datetime

from app.database.models import HouseChat
from app.database.session import session_factory
from app.services.house_chats import ConnectionError, confirm_connection
from maxapi import F, Router
from maxapi.types import BotRemoved, MessageCallback, MessageCreated
from maxapi.types.errors import Error
from sqlalchemy import select

router = Router()
logger = logging.getLogger(__name__)


def is_group(event):
    message = getattr(event, "message", None)
    recipient = getattr(message, "recipient", None)
    return (
        recipient is not None
        and str(getattr(recipient.chat_type, "value", recipient.chat_type)) != "dialog"
    )


@router.message_created(F.func(is_group))
async def group_message(event: MessageCreated):
    recipient = event.message.recipient
    if str(getattr(recipient.chat_type, "value", recipient.chat_type)) != "chat":
        return
    match = re.fullmatch(
        r"/domoved(?:@[A-Za-z0-9_]+)?\s+([a-f0-9]{24})", (event.message.body.text or "").strip()
    )
    if not match or not event.from_user or event.from_user.is_bot:
        return
    # Ordinary messages, /start, and resident callbacks never reach private flows.
    chat_id, user_id = recipient.chat_id, event.from_user.user_id
    try:
        member = await event.bot.get_chat_member(chat_id=chat_id, user_id=user_id)
        if isinstance(member, Error) or not member or not (member.is_admin or member.is_owner):
            return
        chat = await event.bot.get_chat_by_id(id=chat_id)
        if isinstance(chat, Error):
            return
        async with session_factory() as session:
            await confirm_connection(
                session, match[1], chat_id, chat.title or "Домовой чат", user_id
            )
    except ConnectionError as error:
        await event.message.answer(str(error))
    except Exception as error:
        logger.warning("Group connection failed: %s", type(error).__name__)


@router.message_callback(F.func(is_group))
async def ignore_group_callback(event: MessageCallback):
    # Pinned navigation uses links; obsolete private-menu buttons in a group are ignored.
    return


@router.bot_removed()
async def removed(event: BotRemoved):
    async with session_factory.begin() as session:
        chat = await session.scalar(
            select(HouseChat).where(HouseChat.chat_id == event.chat_id).with_for_update()
        )
        if chat:
            chat.status = "attention"
            chat.error = "Бот удалён из группы. Добавьте его заново и восстановите меню."
            chat.checked_at = datetime.now(UTC)
