from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.database.models import IssueMessage, MiniAppPresence, StaffNotification, User
from fastapi import HTTPException
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.services.issue_chat import own_issue


async def update_presence(
    session: AsyncSession,
    user: User,
    client_id: UUID,
    sequence: int,
    active: bool,
    *,
    issue_id: int | None = None,
    last_message_id: int | None = None,
) -> None:
    await session.scalar(select(User.id).where(User.id == user.id).with_for_update())
    now = datetime.now(UTC)
    await session.execute(
        delete(MiniAppPresence).where(
            MiniAppPresence.user_id == user.id,
            MiniAppPresence.expires_at < now - timedelta(days=1),
        )
    )
    current = await session.get(MiniAppPresence, (user.id, str(client_id)))
    if issue_id is not None:
        await own_issue(session, user.id, issue_id)
    if current is not None and sequence <= current.sequence:
        return
    if issue_id is not None:
        if last_message_id is not None:
            message = await session.scalar(
                select(IssueMessage.id).where(
                    IssueMessage.id == last_message_id, IssueMessage.issue_id == issue_id
                )
            )
            if message is None:
                raise HTTPException(422, "Сообщение не принадлежит этому обращению")
            # A final receipt may arrive on closing the chat. Already read
            # messages must never become delayed MAX notifications.
            await session.execute(
                update(StaffNotification)
                .where(
                    StaffNotification.issue_id == issue_id,
                    StaffNotification.max_user_id == user.max_user_id,
                    StaffNotification.kind == "message",
                    StaffNotification.message_id <= last_message_id,
                    StaffNotification.sent_at.is_(None),
                    StaffNotification.suppressed_at.is_(None),
                )
                .values(suppressed_at=now, lease_token=None)
            )
    if current is None:
        current = MiniAppPresence(user_id=user.id, client_id=str(client_id), sequence=0)
        session.add(current)
    current.sequence = sequence
    current.issue_id = issue_id
    lifetime = 30 if issue_id is not None else 45
    current.expires_at = now + timedelta(seconds=lifetime) if active else now
    await session.commit()
