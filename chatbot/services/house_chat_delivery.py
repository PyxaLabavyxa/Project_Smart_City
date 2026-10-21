"""Deliver only pinned navigation and announcements explicitly published by staff."""

import asyncio
import logging
from datetime import UTC, datetime, timedelta
from pathlib import Path

from maxapi.enums.parse_mode import ParseMode
from maxapi.types import LinkButton
from maxapi.types.errors import Error
from maxapi.types.input_media import InputMedia
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from sqlalchemy import select, update

from app.database.models import (
    Announcement,
    AnnouncementDelivery,
    AnnouncementPrivateDelivery,
    House,
    HouseChat,
    StaffHouse,
    StaffUser,
    User,
)
from app.services.announcement_audience import residents, unavailable_reason
from app.services.announcement_format import announcement_message
from chatbot.keyboards.inline import mini_app_username

logger = logging.getLogger(__name__)
WELCOME_IMAGE = Path(__file__).resolve().parents[1] / "assets" / "welcome-house.png"


class MaxRejected(ValueError):
    def __init__(self, code):
        self.code = code


def checked(result):
    if isinstance(result, Error):
        raise MaxRejected(result.code)
    if result is None:
        raise RuntimeError("Empty MAX response")
    return result


async def check_permissions(bot, chat_id):
    me = checked(await bot.get_me_from_chat(chat_id=chat_id))
    permissions = {getattr(p, "value", p) for p in (me.permissions or [])}
    if not me.is_owner and (
        not me.is_admin or not {"write", "pin_message", "read_all_messages"}.issubset(permissions)
    ):
        raise MaxRejected(403)


def menu_keyboard(house_id):
    builder = InlineKeyboardBuilder()
    username = mini_app_username()
    for label, section in [
        ("📝 Сообщить о проблеме", "report"),
        ("🏠 Обращения дома", "issues"),
        ("☎️ Контакты УК", "contacts"),
    ]:
        builder.row(
            LinkButton(
                text=label, url=f"https://max.ru/{username}?startapp={section}_house_{house_id}"
            )
        )
    return builder.as_markup()


def delivery_error(error, *, uncertain=False):
    if uncertain:
        return (
            "MAX мог принять сообщение, но подтверждение не получено. "
            "Проверьте чат; повторная отправка отключена."
        )
    if isinstance(error, MaxRejected) and error.code in (401, 403, 404):
        return "Проверьте, что бот состоит в группе и имеет права чтения, отправки и закрепления."
    return "MAX отклонил отправку. Проверьте подключение и повторите попытку."


async def recover_interrupted(sessions):
    cutoff = datetime.now(UTC) - timedelta(minutes=10)
    async with sessions.begin() as session:
        await session.execute(
            update(AnnouncementPrivateDelivery)
            .where(
                AnnouncementPrivateDelivery.status == "sending",
                AnnouncementPrivateDelivery.attempted_at < cutoff,
            )
            .values(
                status="uncertain",
                error="Результат MAX неизвестен. Проверьте личный диалог; повтор отключён.",
            )
        )
        await session.execute(
            update(AnnouncementDelivery)
            .where(
                AnnouncementDelivery.status == "sending", AnnouncementDelivery.attempted_at < cutoff
            )
            .values(status="uncertain", error=delivery_error(None, uncertain=True))
        )
        await session.execute(
            update(HouseChat)
            .where(HouseChat.menu_status == "sending", HouseChat.menu_attempted_at < cutoff)
            .values(
                menu_status="uncertain",
                status="attention",
                error=delivery_error(None, uncertain=True),
            )
        )


async def process_menu(bot, sessions):
    async with sessions.begin() as session:
        row = await session.scalar(
            select(HouseChat)
            .where(HouseChat.chat_id.is_not(None), HouseChat.menu_status == "pending")
            .order_by(HouseChat.house_id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if row is None:
            return False
        house = await session.get(House, row.house_id)
        house_id, chat_id, revision, mid, address = (
            row.house_id,
            row.chat_id,
            row.revision,
            row.menu_message_id,
            house.address,
        )
        row.menu_status, row.menu_attempted_at = "sending", datetime.now(UTC)
    sending = False
    try:
        await check_permissions(bot, chat_id)
        text = (
            f"👋 Привет! Я Домовед — помощник жителей дома.\n📍 {address}\n\n"
            "Через кнопки ниже можно сообщить о проблеме, посмотреть обращения и контакты УК. "
            "В приложении проверьте выбранный адрес.\n\n"
            "🔔 Здесь появляются только важные объявления управляющей компании. "
            "Обращения и личная переписка остаются в мини-приложении."
        )
        attachments = [
            await asyncio.to_thread(InputMedia, str(WELCOME_IMAGE)),
            menu_keyboard(house_id),
        ]
        if mid:
            edited = await bot.edit_message(
                message_id=mid, text=text, attachments=attachments, notify=False
            )
            if isinstance(edited, Error) and edited.code == 404:
                mid = None
            else:
                checked(edited)
        if not mid:
            sending = True
            result = checked(
                await bot.send_message(
                    chat_id=chat_id, text=text, attachments=attachments, notify=False
                )
            )
            mid = result.message.body.mid
            async with sessions.begin() as session:
                await session.execute(
                    update(HouseChat)
                    .where(
                        HouseChat.house_id == house_id,
                        HouseChat.chat_id == chat_id,
                        HouseChat.revision == revision,
                    )
                    .values(menu_message_id=mid)
                )
            sending = False
        checked(await bot.pin_message(chat_id=chat_id, message_id=mid, notify=False))
        status, state, error = "ready", "connected", ""
    except Exception as exc:
        uncertain = sending and (
            not isinstance(exc, MaxRejected) or exc.code >= 500 or exc.code == 408
        )
        status, state = ("uncertain" if uncertain else "failed"), "attention"
        error = delivery_error(exc, uncertain=uncertain)
        logger.warning("Pinned menu delivery failed: %s", type(exc).__name__)
    async with sessions.begin() as session:
        await session.execute(
            update(HouseChat)
            .where(
                HouseChat.house_id == house_id,
                HouseChat.chat_id == chat_id,
                HouseChat.revision == revision,
                HouseChat.menu_status == "sending",
            )
            .values(menu_status=status, status=state, error=error, checked_at=datetime.now(UTC))
        )
    return True


async def process_announcement(bot, sessions):
    async with sessions.begin() as session:
        delivery = await session.scalar(
            select(AnnouncementDelivery)
            .where(AnnouncementDelivery.status == "pending")
            .order_by(AnnouncementDelivery.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if delivery is None:
            return False
        announcement = await session.get(Announcement, delivery.announcement_id)
        chat = await session.get(HouseChat, delivery.house_id)
        allowed = await session.scalar(
            select(StaffHouse.id)
            .join(StaffUser, StaffUser.id == StaffHouse.staff_id)
            .where(
                StaffHouse.staff_id == announcement.staff_id,
                StaffHouse.house_id == delivery.house_id,
                StaffUser.active.is_(True),
            )
        )
        if (
            not allowed
            or not chat
            or chat.status != "connected"
            or chat.menu_status != "ready"
            or chat.chat_id != delivery.chat_id
            or chat.revision != delivery.chat_revision
        ):
            delivery.status, delivery.error = (
                "cancelled",
                "Подключение или доступ сотрудника изменились",
            )
            return True
        delivery_id, chat_id = delivery.id, delivery.chat_id
        text, message_format = announcement_message(
            announcement.topic, announcement.title, announcement.text
        )
        delivery.status, delivery.attempted_at = "sending", datetime.now(UTC)
    sending, mid = False, None
    try:
        await check_permissions(bot, chat_id)
        sending = True
        result = checked(
            await bot.send_message(
                chat_id=chat_id,
                text=text,
                notify=True,
                parse_mode=ParseMode(message_format) if message_format else None,
            )
        )
        mid = result.message.body.mid
        status, error = "sent", ""
    except Exception as exc:
        uncertain = sending and (
            not isinstance(exc, MaxRejected) or exc.code >= 500 or exc.code == 408
        )
        status = "uncertain" if uncertain else "failed"
        error = delivery_error(exc, uncertain=uncertain)
        logger.warning("Announcement delivery failed: %s", type(exc).__name__)
    async with sessions.begin() as session:
        await session.execute(
            update(AnnouncementDelivery)
            .where(AnnouncementDelivery.id == delivery_id, AnnouncementDelivery.status == "sending")
            .values(
                status=status,
                message_id=mid,
                error=error,
                sent_at=datetime.now(UTC) if status == "sent" else None,
            )
        )
        if status == "failed":
            await session.execute(
                update(HouseChat)
                .where(HouseChat.chat_id == chat_id)
                .values(status="attention", error=error, checked_at=datetime.now(UTC))
            )
    return True


async def process_private_announcement(bot, sessions):
    async with sessions.begin() as session:
        delivery = await session.scalar(
            select(AnnouncementPrivateDelivery)
            .where(AnnouncementPrivateDelivery.status == "pending")
            .order_by(AnnouncementPrivateDelivery.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if delivery is None:
            return False
        announcement = await session.get(Announcement, delivery.announcement_id)
        targets = await residents(
            session, announcement.staff_id, announcement.house_ids, [delivery.user_id]
        )
        target = targets.get(delivery.user_id)
        if not target or unavailable_reason(target["user"]):
            delivery.status, delivery.error = "cancelled", "Доступ или настройки жителя изменились"
            return True
        delivery_id, user_id, max_id = delivery.id, delivery.user_id, target["user"].max_user_id
        text, message_format = announcement_message(
            announcement.topic, announcement.title, announcement.text
        )
        delivery.status, delivery.attempted_at = "sending", datetime.now(UTC)
    mid, blocked = None, False
    try:
        result = checked(
            await bot.send_message(
                user_id=max_id,
                text=text,
                notify=True,
                parse_mode=ParseMode(message_format) if message_format else None,
            )
        )
        mid = result.message.body.mid
        status, error = "sent", ""
    except Exception as exc:
        uncertain = not isinstance(exc, MaxRejected) or exc.code >= 500 or exc.code == 408
        blocked = isinstance(exc, MaxRejected) and exc.code in (403, 404)
        status = "uncertain" if uncertain else "failed"
        error = (
            "Результат MAX неизвестен. Проверьте личный диалог; повтор отключён."
            if uncertain
            else "MAX отклонил отправку. Жителю нужно открыть бота "
            "и проверить настройки уведомлений."
        )
        logger.warning("Private announcement delivery failed: %s", type(exc).__name__)
    async with sessions.begin() as session:
        await session.execute(
            update(AnnouncementPrivateDelivery)
            .where(
                AnnouncementPrivateDelivery.id == delivery_id,
                AnnouncementPrivateDelivery.status == "sending",
            )
            .values(
                status=status,
                message_id=mid,
                error=error,
                sent_at=datetime.now(UTC) if status == "sent" else None,
            )
        )
        if blocked:
            await session.execute(
                update(User).where(User.id == user_id).values(bot_dialog_started=False)
            )
    return True


async def run_house_chat_delivery(bot, sessions):
    while True:
        try:
            await recover_interrupted(sessions)
            await process_menu(bot, sessions)
            await process_announcement(bot, sessions)
            await process_private_announcement(bot, sessions)
        except Exception as exc:
            logger.warning("House chat worker failed: %s", type(exc).__name__)
        await asyncio.sleep(2)
