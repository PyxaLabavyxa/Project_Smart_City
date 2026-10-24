import asyncio
import logging
from datetime import UTC, datetime, timedelta

from maxapi.types.errors import Error
from sqlalchemy import select

from app.database.models import (
    Apartment,
    ApartmentMessage,
    House,
    MessageNotification,
    MiniAppPresence,
    User,
    UserApartment,
)
from app.database.notification_preferences import notification_enabled
from app.database.session import session_factory
from chatbot.keyboards.inline import inl_notification

logger = logging.getLogger(__name__)


async def deliver_pending(bot, sessions=session_factory):
    for _ in range(20):
        async with sessions() as session:
            notification = await session.scalar(
                select(MessageNotification)
                .where(
                    MessageNotification.sent_at.is_(None),
                    MessageNotification.suppressed_at.is_(None),
                    MessageNotification.available_at <= datetime.now(UTC),
                )
                .order_by(MessageNotification.id)
                .limit(1)
                .with_for_update(skip_locked=True)
            )
            if notification is None:
                return
            message = await session.get(ApartmentMessage, notification.message_id)
            member = (
                await session.scalar(
                    select(UserApartment.id)
                    .join(User, User.id == UserApartment.user_id)
                    .where(
                        User.max_user_id == notification.max_user_id,
                        UserApartment.apartment_id == message.recipient_id,
                    )
                    .limit(1)
                )
                if message is not None
                else None
            )
            if member is None:
                notification.suppressed_at = datetime.now(UTC)
                await session.commit()
                continue
            active = await session.scalar(
                select(MiniAppPresence.user_id)
                .join(User, User.id == MiniAppPresence.user_id)
                .where(
                    User.max_user_id == notification.max_user_id,
                    MiniAppPresence.expires_at > datetime.now(UTC),
                )
                .limit(1)
            )
            if active is not None or not await notification_enabled(
                session, notification.max_user_id, "personal_messages"
            ):
                notification.suppressed_at = datetime.now(UTC)
                await session.commit()
                continue
            sender = await session.get(Apartment, message.sender_id)
            recipient = await session.get(Apartment, message.recipient_id)
            house = await session.get(House, sender.house_id)
            try:
                result = await asyncio.wait_for(
                    bot.send_message(
                        user_id=notification.max_user_id,
                        notify=True,
                        attachments=[inl_notification()],
                        text=(
                            f"Новое сообщение от квартиры {sender.number}\n"
                            f"{house.address} · для квартиры {recipient.number}\n\n"
                            f"{message.text[:1500]}\n\n"
                            "Нажмите «Мой Домовед» ниже и перейдите в раздел «Сообщения», "
                            "чтобы ответить."
                        ),
                    ),
                    timeout=15,
                )
                if result is None or isinstance(result, Error):
                    raise RuntimeError("MAX rejected notification")
            except Exception:
                notification.attempts += 1
                notification.available_at = datetime.now(UTC) + timedelta(
                    seconds=min(3600, 5 * 2 ** min(notification.attempts, 10))
                )
                logger.warning("Message notification %s will be retried", notification.id)
            else:
                notification.sent_at = datetime.now(UTC)
            await session.commit()


async def run_message_notifications(bot):
    while True:
        try:
            await deliver_pending(bot)
        except Exception:
            logger.exception("Message notification queue unavailable")
        await asyncio.sleep(5)
