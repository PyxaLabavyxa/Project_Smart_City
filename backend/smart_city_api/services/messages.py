from app.database.models import Apartment, ApartmentMessage
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.app import MessageResponse, SendMessage
from smart_city_api.services.access import require_apartment


async def message_response(
    session: AsyncSession, message: ApartmentMessage, apartment_id: int
) -> MessageResponse:
    outgoing = message.sender_id == apartment_id
    other_id = message.recipient_id if outgoing else message.sender_id
    other = await session.get(Apartment, other_id)
    return MessageResponse(
        id=message.id,
        apartment=other.number,
        text=message.text,
        direction="outgoing" if outgoing else "incoming",
        createdAt=message.created_at,
    )


async def send_message(
    session: AsyncSession, user_id: int, apartment_id: int, data: SendMessage
) -> MessageResponse:
    sender = await require_apartment(session, user_id, apartment_id)
    recipient = await session.get(Apartment, data.recipient_id)
    if recipient is None or recipient.house_id != sender.house_id or recipient.id == sender.id:
        raise HTTPException(422, "Выберите другую квартиру своего дома")
    statement = select(ApartmentMessage).where(
        ApartmentMessage.user_id == user_id, ApartmentMessage.request_id == str(data.request_id)
    )

    def check_retry(message: ApartmentMessage):
        if (message.sender_id, message.recipient_id, message.text) != (
            apartment_id,
            data.recipient_id,
            data.text,
        ):
            raise HTTPException(409, "Этот ключ запроса уже использован для другого сообщения")

    existing = await session.scalar(statement)
    if existing:
        check_retry(existing)
        return await message_response(session, existing, apartment_id)
    message = ApartmentMessage(
        user_id=user_id,
        sender_id=apartment_id,
        recipient_id=data.recipient_id,
        text=data.text,
        request_id=str(data.request_id),
    )
    try:
        session.add(message)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(statement)
        if existing is None:
            raise
        check_retry(existing)
        return await message_response(session, existing, apartment_id)
    return await message_response(session, message, apartment_id)
