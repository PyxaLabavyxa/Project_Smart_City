from urllib.parse import urlsplit

from app.database.models import ApartmentMessage, HouseCamera, HouseWork
from fastapi import APIRouter, HTTPException
from sqlalchemy import or_, select

from smart_city_api.api.dependencies import Resident, Session
from smart_city_api.api.routes.resident import Cursor, Limit
from smart_city_api.schemas.app import (
    AccountResponse,
    CameraFrame,
    CameraResponse,
    MessagePage,
    MessageResponse,
    ReadingInput,
    SendMessage,
    WorkResponse,
)
from smart_city_api.services.access import require_apartment, require_house
from smart_city_api.services.messages import message_response, send_message
from smart_city_api.services.utilities import load_account, save_reading

router = APIRouter(prefix="/api/v1", tags=["services"])


@router.get("/apartments/{apartment_id}/messages", response_model=MessagePage)
async def messages(
    apartment_id: int, session: Session, user: Resident, cursor: Cursor = 0, limit: Limit = 100
):
    await require_apartment(session, user.id, apartment_id)
    rows = (
        await session.scalars(
            select(ApartmentMessage)
            .where(
                or_(
                    ApartmentMessage.sender_id == apartment_id,
                    ApartmentMessage.recipient_id == apartment_id,
                ),
                ApartmentMessage.id > cursor,
            )
            .order_by(ApartmentMessage.id)
            .limit(limit + 1)
        )
    ).all()
    return MessagePage(
        items=[await message_response(session, row, apartment_id) for row in rows[:limit]],
        next_cursor=rows[limit - 1].id if len(rows) > limit else None,
    )


@router.post("/apartments/{apartment_id}/messages", response_model=MessageResponse, status_code=201)
async def send(apartment_id: int, data: SendMessage, session: Session, user: Resident):
    return await send_message(session, user.id, apartment_id, data)


@router.get("/apartments/{apartment_id}/utilities", response_model=AccountResponse | None)
async def account(apartment_id: int, session: Session, user: Resident):
    return await load_account(session, user.id, apartment_id)


@router.post("/meters/{meter_id}/readings", response_model=AccountResponse)
async def reading(meter_id: int, data: ReadingInput, session: Session, user: Resident):
    return await save_reading(session, user.id, meter_id, data)


@router.get("/houses/{house_id}/cameras", response_model=list[CameraResponse])
async def cameras(house_id: int, session: Session, user: Resident):
    await require_house(session, user.id, house_id)
    rows = (
        await session.scalars(
            select(HouseCamera)
            .where(
                HouseCamera.house_id == house_id,
            )
            .order_by(HouseCamera.id)
        )
    ).all()
    return [CameraResponse(id=str(c.id), name=c.name, status=c.status, note=c.note) for c in rows]


@router.get("/cameras/{camera_id}/preview", response_model=CameraFrame)
async def preview(camera_id: int, session: Session, user: Resident):
    camera = await session.get(HouseCamera, camera_id)
    if camera is None:
        raise HTTPException(404, "Камера не найдена")
    await require_house(session, user.id, camera.house_id)
    if camera.status != "online" or not camera.preview_url or not camera.captured_at:
        raise HTTPException(503, "Изображение камеры пока недоступно")
    url = urlsplit(camera.preview_url)
    if url.scheme != "https" or not url.hostname or url.username or url.password:
        raise HTTPException(503, "Изображение камеры пока недоступно")
    return CameraFrame(src=camera.preview_url, capturedAt=camera.captured_at)


@router.get("/houses/{house_id}/works", response_model=list[WorkResponse])
async def works(house_id: int, session: Session, user: Resident):
    await require_house(session, user.id, house_id)
    rows = (
        await session.scalars(
            select(HouseWork)
            .where(
                HouseWork.house_id == house_id,
            )
            .order_by(HouseWork.starts_at.desc())
            .limit(100)
        )
    ).all()
    return [WorkResponse.model_validate(row, from_attributes=True) for row in rows]
