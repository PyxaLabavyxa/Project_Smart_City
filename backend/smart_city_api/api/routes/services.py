from datetime import UTC, datetime

from app.database.models import ApartmentMessage, ChatPhoto, HouseWork
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse
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
from smart_city_api.schemas.cameras import CameraSettings, CreateCamera, UpdateCamera
from smart_city_api.services import camera_media, chat_photos
from smart_city_api.services import cameras as camera_service
from smart_city_api.services.access import own_apartment_ids, require_apartment, require_house
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


@router.post(
    "/apartments/{apartment_id}/messages/with-photos",
    openapi_extra=chat_photos.MULTIPART,
    response_model=MessageResponse,
    status_code=201,
)
async def send_photos(apartment_id: int, request: Request, session: Session, user: Resident):
    await require_apartment(session, user.id, apartment_id)
    async with chat_photos.upload(request, SendMessage) as (data, photos):
        return await send_message(session, user.id, apartment_id, data, photos)


@router.get("/chat-photos/{photo_id}", response_class=FileResponse)
async def chat_photo(photo_id: int, request: Request, session: Session, user: Resident):
    from app.database.models import IssueMessage

    from smart_city_api.services.issue_chat import own_issue

    record = await session.get(ChatPhoto, photo_id)
    if record is None:
        raise HTTPException(404, "Фотография не найдена")
    if record.apartment_message_id is not None:
        permitted = await session.scalar(
            select(ApartmentMessage.id).where(
                ApartmentMessage.id == record.apartment_message_id,
                or_(
                    ApartmentMessage.sender_id.in_(own_apartment_ids(user.id)),
                    ApartmentMessage.recipient_id.in_(own_apartment_ids(user.id)),
                ),
            )
        )
        if permitted is None:
            raise HTTPException(404, "Фотография не найдена")
    else:
        message = await session.get(IssueMessage, record.issue_message_id)
        if message is None:
            raise HTTPException(404, "Фотография не найдена")
        await own_issue(session, user.id, message.issue_id)
    return await chat_photos.response(request, record)


@router.get("/apartments/{apartment_id}/utilities", response_model=AccountResponse | None)
async def account(apartment_id: int, session: Session, user: Resident):
    return await load_account(session, user.id, apartment_id)


@router.post("/meters/{meter_id}/readings", response_model=AccountResponse)
async def reading(meter_id: int, data: ReadingInput, session: Session, user: Resident):
    return await save_reading(session, user.id, meter_id, data)


@router.get("/houses/{house_id}/cameras", response_model=list[CameraResponse])
async def cameras(house_id: int, session: Session, user: Resident):
    return await camera_service.list_cameras(session, user.id, house_id)


@router.post("/houses/{house_id}/cameras", response_model=CameraResponse, status_code=201)
async def add_camera(
    house_id: int, data: CreateCamera, request: Request, session: Session, user: Resident
):
    return await camera_service.create_camera(
        session, user.id, house_id, data, request.app.state.settings
    )


@router.get("/cameras/{camera_id}/preview", response_model=CameraFrame)
async def preview(camera_id: int, request: Request, session: Session, user: Resident):
    return await camera_service.preview_camera(
        session, user.id, camera_id, datetime.now(UTC), request.app.state.settings
    )


@router.get("/cameras/{camera_id}/settings", response_model=CameraSettings)
async def camera_settings(camera_id: int, request: Request, session: Session, user: Resident):
    return await camera_service.camera_settings(
        session, user.id, camera_id, request.app.state.settings
    )


@router.post("/cameras/{camera_id}/settings", response_model=CameraResponse)
async def update_camera(
    camera_id: int, data: UpdateCamera, request: Request, session: Session, user: Resident
):
    return await camera_service.update_camera(
        session, user.id, camera_id, data, request.app.state.settings
    )


@router.delete("/cameras/{camera_id}", status_code=204)
async def delete_camera(camera_id: int, session: Session, user: Resident):
    await camera_service.delete_owned_camera(session, user.id, camera_id)


@router.get("/cameras/{camera_id}/live")
async def camera_live(camera_id: int, request: Request, session: Session, user: Resident):
    camera = await camera_service.accessible_camera(session, user.id, camera_id)
    if not camera.source_config or camera.source_type == "snapshot":
        raise HTTPException(422, "Эта камера предоставляет только снимки")
    source = camera_media.decode(camera.source_config, request.app.state.settings)
    return StreamingResponse(
        camera_media.live_chunks(source, request.app.state.settings),
        media_type="multipart/x-mixed-replace; boundary=camera",
        headers={"X-Accel-Buffering": "no"},
    )


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
