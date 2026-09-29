import asyncio
import logging
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from maxapi.types import CallbackButton
from maxapi.types.errors import Error
from maxapi.utils.inline_keyboard import InlineKeyboardBuilder
from sqlalchemy import exists, select, update

from app.database.models import StaffNotification
from app.database.session import session_factory
from chatbot.keyboards.inline import mini_app_button

logger = logging.getLogger(__name__)


def reply_keyboard(issue_id: int):
    builder = InlineKeyboardBuilder()
    builder.add(CallbackButton(text="💬 Ответить сотруднику", payload=f"staff_reply_{issue_id}"))
    builder.row(mini_app_button())
    return builder.as_markup()


async def claim_next(sessions):
    now = datetime.now(UTC)
    async with sessions.begin() as session:
        previous = StaffNotification.__table__.alias("previous")
        candidate = await session.scalar(
            select(StaffNotification.id)
            .where(
                StaffNotification.sent_at.is_(None),
                StaffNotification.available_at <= now,
                ~exists(
                    select(previous.c.id).where(
                        previous.c.issue_id == StaffNotification.issue_id,
                        previous.c.id < StaffNotification.id,
                        previous.c.sent_at.is_(None),
                    )
                ),
            )
            .order_by(StaffNotification.id)
            .limit(1)
            .with_for_update(skip_locked=True)
        )
        if candidate is None:
            return None
        lease = str(uuid4())
        row = (
            await session.execute(
                update(StaffNotification)
                .where(
                    StaffNotification.id == candidate,
                    StaffNotification.sent_at.is_(None),
                    StaffNotification.available_at <= now,
                )
                .values(
                    lease_token=lease,
                    available_at=now + timedelta(seconds=60),
                )
                .returning(
                    StaffNotification.id,
                    StaffNotification.issue_id,
                    StaffNotification.max_user_id,
                    StaffNotification.text,
                    StaffNotification.attempts,
                )
            )
        ).one_or_none()
        return (row, lease) if row else None


async def deliver_pending(bot, sessions=session_factory, limit: int = 20) -> int:
    delivered = 0
    for _ in range(limit):
        claim = await claim_next(sessions)
        if claim is None:
            break
        row, lease = claim
        success = False
        try:
            async with asyncio.timeout(25):
                result = await bot.send_message(
                    user_id=row.max_user_id,
                    text=row.text,
                    notify=True,
                    attachments=[reply_keyboard(row.issue_id)],
                )
            if result is None or isinstance(result, Error):
                raise RuntimeError("MAX did not confirm sending")
            success = True
        except Exception as exc:
            logger.warning("Staff notification %s failed: %s", row.id, type(exc).__name__)
        now = datetime.now(UTC)
        values = {"lease_token": None, "attempts": row.attempts + 1}
        if success:
            values["sent_at"] = now
            delivered += 1
        else:
            values["available_at"] = now + timedelta(
                seconds=min(3600, 5 * 2 ** min(row.attempts + 1, 10))
            )
        async with sessions.begin() as session:
            await session.execute(
                update(StaffNotification)
                .where(
                    StaffNotification.id == row.id,
                    StaffNotification.lease_token == lease,
                    StaffNotification.sent_at.is_(None),
                )
                .values(**values)
            )
    return delivered


async def run_staff_notifications(bot) -> None:
    while True:
        try:
            await deliver_pending(bot)
        except Exception:
            logger.exception("Staff notification worker iteration failed")
        await asyncio.sleep(5)
