import re
from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import String, cast, func, select, update

from app.database.models import (
    Apartment,
    ApartmentMessage,
    House,
    InboxNotification,
    MessageNotification,
    StaffHouse,
)
from smart_city_api.services.access import require_apartment


def scope(owner, recipient_id):
    if owner == "staff_id":
        return (
            InboxNotification.staff_id == recipient_id,
            InboxNotification.house_id.in_(
                select(StaffHouse.house_id).where(StaffHouse.staff_id == recipient_id)
            ),
        )
    return (InboxNotification.user_id == recipient_id,)


async def count_unread(session, owner, recipient_id):
    return await session.scalar(
        select(func.count())
        .select_from(InboxNotification)
        .where(*scope(owner, recipient_id), InboxNotification.read_at.is_(None))
    )


def notification_title(row):
    # Older events retain their stored text; use the same readable wording in history.
    if row.kind == "issue_status":
        previous = re.fullmatch(r"Обращение №(\d+) — (.+)", row.title)
        if previous:
            return f"Изменён статус вашего обращения №{previous[1]}: {previous[2]}"
    return row.title


async def read_inbox(session, owner, recipient_id, *, before=None, limit=30, unread_only=False):
    conditions = scope(owner, recipient_id)
    latest = await session.scalar(select(func.max(InboxNotification.id)).where(*conditions)) or 0
    query = (
        select(InboxNotification, House.address)
        .outerjoin(House, House.id == InboxNotification.house_id)
        .where(*conditions)
    )
    if before is not None:
        query = query.where(InboxNotification.id < before)
    if unread_only:
        query = query.where(InboxNotification.read_at.is_(None))
    rows = (
        await session.execute(query.order_by(InboxNotification.id.desc()).limit(limit + 1))
    ).all()
    return {
        "items": [
            {
                "id": row.id,
                "kind": row.kind,
                "title": notification_title(row),
                "body": row.body,
                "href": row.href,
                "house_id": row.house_id,
                "apartment_id": row.apartment_id,
                "address": address,
                "created_at": row.created_at,
                "read_at": row.read_at,
            }
            for row, address in rows[:limit]
        ],
        "next_cursor": rows[limit - 1][0].id if len(rows) > limit else None,
        "unread_count": await count_unread(session, owner, recipient_id),
        "snapshot_id": latest,
    }


async def mark_read(session, owner, recipient_id, notification_id):
    row = await session.scalar(
        select(InboxNotification).where(
            *scope(owner, recipient_id), InboxNotification.id == notification_id
        )
    )
    if row is None:
        raise HTTPException(404, "Уведомление не найдено")
    await session.execute(
        update(InboxNotification)
        .where(
            *scope(owner, recipient_id),
            InboxNotification.id == notification_id,
            InboxNotification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    await session.commit()
    return {"unread_count": await count_unread(session, owner, recipient_id)}


async def mark_all_read(session, owner, recipient_id, through_id):
    await session.execute(
        update(InboxNotification)
        .where(
            *scope(owner, recipient_id),
            InboxNotification.id <= through_id,
            InboxNotification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    await session.commit()
    return {"unread_count": await count_unread(session, owner, recipient_id)}


async def mark_conversation_read(session, user, data):
    apartment = await require_apartment(session, user.id, data.apartment_id)
    sender_id = await session.scalar(
        select(Apartment.id).where(
            Apartment.house_id == apartment.house_id,
            Apartment.number == data.sender_number,
        )
    )
    incoming = (
        ApartmentMessage.recipient_id == apartment.id,
        ApartmentMessage.sender_id == sender_id,
        ApartmentMessage.id <= data.through_message_id,
    )
    # The cursor must be an incoming message that was actually shown in this conversation.
    shown = await session.scalar(
        select(ApartmentMessage.id).where(
            *incoming,
            ApartmentMessage.id == data.through_message_id,
        )
    )
    if shown is None:
        raise HTTPException(404, "Сообщение не найдено")
    await session.execute(
        update(InboxNotification)
        .where(
            InboxNotification.user_id == user.id,
            InboxNotification.kind == "personal_message",
            InboxNotification.apartment_id == apartment.id,
            InboxNotification.event_key.in_(
                select("apartment-message:" + cast(ApartmentMessage.id, String)).where(*incoming)
            ),
            InboxNotification.read_at.is_(None),
        )
        .values(read_at=datetime.now(UTC))
    )
    await session.execute(
        update(MessageNotification)
        .where(
            MessageNotification.max_user_id == user.max_user_id,
            MessageNotification.message_id.in_(select(ApartmentMessage.id).where(*incoming)),
            MessageNotification.sent_at.is_(None),
            MessageNotification.suppressed_at.is_(None),
        )
        .values(suppressed_at=datetime.now(UTC))
    )
    await session.commit()
    return {"unread_count": await count_unread(session, "user_id", user.id)}
