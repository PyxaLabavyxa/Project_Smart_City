"""Connection confirmation shared by the bot and staff API."""

import hashlib
import re
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database.models import HouseChat, StaffHouse, StaffUser


def code_hash(code: str) -> str:
    return hashlib.sha256(code.encode()).hexdigest()


class ConnectionError(ValueError):
    pass


def normalize_chat_link(value: object) -> str | None:
    """Only HTTPS links to MAX itself; never forward arbitrary URLs to the client."""
    if not isinstance(value, str):
        return None
    value = value.strip()
    if len(value) > 1024 or not re.fullmatch(
        r"https://max\.ru/[A-Za-z0-9_-]+(?:/[A-Za-z0-9_-]+)*/?", value
    ):
        return None
    return value


def utc(value):
    return value.replace(tzinfo=UTC) if value.tzinfo is None else value


async def confirm_connection(session, code, chat_id, title, admin_id, *, link=None):
    chat = await session.scalar(
        select(HouseChat).where(HouseChat.code_hash == code_hash(code)).with_for_update()
    )
    if not chat or not chat.code_expires_at or utc(chat.code_expires_at) <= datetime.now(UTC):
        raise ConnectionError("Код недействителен или истёк. Получите новый код в кабинете УК.")
    allowed = await session.scalar(
        select(StaffHouse.id)
        .join(StaffUser, StaffUser.id == StaffHouse.staff_id)
        .where(
            StaffHouse.house_id == chat.house_id,
            StaffHouse.staff_id == chat.code_staff_id,
            StaffUser.active.is_(True),
        )
    )
    if allowed is None or chat.chat_id is not None:
        raise ConnectionError("Подключение недоступно. Получите новый код в кабинете УК.")
    chat.chat_id = chat_id
    chat.title = title[:200]
    chat.join_url = None
    chat.platform_link = normalize_chat_link(link)
    chat.link_checked_at = datetime.now(UTC)
    chat.connected_by = admin_id
    chat.status = "connected"
    chat.revision += 1
    chat.checked_at = datetime.now(UTC)
    chat.menu_status = "pending"
    chat.code_hash = chat.code_expires_at = chat.code_staff_id = None
    chat.error = ""
    try:
        await session.commit()
    except IntegrityError as error:
        await session.rollback()
        raise ConnectionError("Эта группа уже подключена к другому дому.") from error
    return chat.house_id
