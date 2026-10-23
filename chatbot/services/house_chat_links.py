"""Read group metadata without sending messages or changing the pinned menu."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta

from maxapi.types.errors import Error
from sqlalchemy import or_, select, update

from app.database.models import HouseChat
from app.services.house_chats import normalize_chat_link

logger = logging.getLogger(__name__)


async def refresh_one_link(bot, sessions):
    now = datetime.now(UTC)
    async with sessions.begin() as session:
        row = await session.scalar(
            select(HouseChat)
            .where(
                HouseChat.chat_id.is_not(None),
                HouseChat.status == "connected",
                or_(
                    HouseChat.link_checked_at.is_(None),
                    HouseChat.link_checked_at < now - timedelta(minutes=15),
                ),
            )
            .order_by(HouseChat.link_checked_at.asc().nullsfirst(), HouseChat.house_id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if row is None:
            return False
        house_id, chat_id, revision = row.house_id, row.chat_id, row.revision
        row.link_checked_at = now

    # Release the transaction before contacting MAX; reserve this check above.
    info = await asyncio.wait_for(bot.get_chat_by_id(id=chat_id), timeout=8)
    if isinstance(info, Error):
        if info.code not in (403, 404):
            return True
        values = {
            "status": "attention",
            "platform_link": None,
            "checked_at": now,
            "error": "Группа недоступна боту. Проверьте подключение и восстановите меню.",
        }
    else:
        if info is None:
            return True
        status = getattr(info.status, "value", info.status)
        if status == "active":
            values = {"platform_link": normalize_chat_link(info.link)}
        elif status in ("removed", "left", "closed"):
            values = {
                "status": "attention",
                "platform_link": None,
                "checked_at": now,
                "error": "Бот удалён из группы или группа закрыта. Проверьте подключение.",
            }
        else:
            return True
    async with sessions.begin() as session:
        await session.execute(
            update(HouseChat)
            .where(
                HouseChat.house_id == house_id,
                HouseChat.chat_id == chat_id,
                HouseChat.revision == revision,
                HouseChat.status == "connected",
            )
            .values(**values)
        )
    return True


async def run_house_chat_links(bot, sessions):
    while True:
        try:
            await refresh_one_link(bot, sessions)
        except Exception as exc:  # noqa: BLE001 - an optional check must not stop the bot
            logger.warning("House chat link check failed: %s", type(exc).__name__)
        await asyncio.sleep(10)
