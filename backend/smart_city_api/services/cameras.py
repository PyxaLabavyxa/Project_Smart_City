import re
from datetime import UTC, datetime
from urllib.parse import urlsplit

from app.database.models import House, HouseCamera, User
from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.app import CameraFrame, CameraResponse, Location
from smart_city_api.schemas.cameras import (
    CreateCamera,
    ModerateCamera,
    StaffCameraPage,
    StaffCameraResponse,
)
from smart_city_api.services.access import require_house
from smart_city_api.services.locations import OUTDOOR_ZONES, validate_location
from smart_city_api.services.staff import house_scope


def visible_cameras(user_id: int):
    return or_(
        HouseCamera.owner_id == user_id,
        and_(HouseCamera.visibility == "public", HouseCamera.moderation_status == "approved"),
    )


def camera_response(camera: HouseCamera, user_id: int | None) -> CameraResponse:
    return CameraResponse(
        id=str(camera.id),
        name=camera.name,
        status=camera.status,
        note=camera.note,
        mine=user_id is not None and camera.owner_id == user_id,
        visibility=camera.visibility,
        moderation_status=camera.moderation_status,
        moderation_reason=camera.moderation_reason,
        place=Location(
            entrance=camera.entrance,
            floor=camera.floor,
            zone=camera.zone,
            apartment_id=camera.apartment_id,
        )
        if camera.zone and (camera.zone in OUTDOOR_ZONES or (camera.entrance and camera.floor))
        else None,
    )


async def list_cameras(session: AsyncSession, user_id: int, house_id: int):
    await require_house(session, user_id, house_id)
    cameras = await session.scalars(
        select(HouseCamera)
        .where(
            HouseCamera.house_id == house_id,
            HouseCamera.deleted_at.is_(None),
            visible_cameras(user_id),
        )
        .order_by(HouseCamera.id)
    )
    return [camera_response(camera, user_id) for camera in cameras]


async def create_camera(session: AsyncSession, user_id: int, house_id: int, data: CreateCamera):
    house = await require_house(session, user_id, house_id)
    await validate_location(session, user_id, house, data.place)
    values = {
        "house_id": house_id,
        "name": data.name,
        "note": data.note,
        "preview_url": data.source_url,
        "visibility": "public" if data.is_public else "private",
        **data.place.model_dump(),
    }
    query = select(HouseCamera).where(
        HouseCamera.owner_id == user_id,
        HouseCamera.request_id == str(data.request_id),
    )

    def previous(camera):
        if camera.deleted_at is not None:
            raise HTTPException(409, "Эта камера удалена. Создайте новую заявку")
        if any(getattr(camera, key) != value for key, value in values.items()):
            raise HTTPException(409, "Этот ключ запроса уже использован для другой камеры")
        return camera_response(camera, user_id)

    existing = await session.scalar(query)
    if existing:
        return previous(existing)
    camera = HouseCamera(
        **values,
        owner_id=user_id,
        request_id=str(data.request_id),
        status="online",
        moderation_status="pending" if data.is_public else "approved",
        captured_at=datetime.now(UTC),
    )
    session.add(camera)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(query)
        if existing is None:
            raise
        return previous(existing)
    return camera_response(camera, user_id)


async def preview_camera(session: AsyncSession, user_id: int, camera_id: int, now: datetime):
    camera = await session.scalar(
        select(HouseCamera).where(
            HouseCamera.id == camera_id,
            HouseCamera.deleted_at.is_(None),
            visible_cameras(user_id),
        )
    )
    if camera is None:
        raise HTTPException(404, "Камера не найдена")
    await require_house(session, user_id, camera.house_id)
    if camera.status != "online" or not camera.preview_url or not camera.captured_at:
        raise HTTPException(503, "Изображение камеры пока недоступно")
    if re.fullmatch(r"/images/cameras/(entrance-[12]|yard)-1\.png", camera.preview_url):
        frame = int(now.timestamp() // 5) % 2 + 1
        return CameraFrame(
            src=camera.preview_url.replace("-1.png", f"-{frame}.png"),
            capturedAt=now,
        )
    url = urlsplit(camera.preview_url)
    if url.scheme != "https" or not url.hostname or url.username or url.password or url.fragment:
        raise HTTPException(503, "Изображение камеры пока недоступно")
    # The browser loads snapshots directly; the API never requests user-supplied URLs.
    return CameraFrame(
        src=camera.preview_url,
        capturedAt=now,
    )


async def list_moderation(
    session: AsyncSession,
    staff_id: int,
    status: str,
    page: int,
    page_size: int,
    house_id: int | None = None,
    entrance: int | None = None,
    floor: int | None = None,
    zone: str | None = None,
):
    conditions = [
        HouseCamera.house_id.in_(house_scope(staff_id)),
        HouseCamera.deleted_at.is_(None),
        HouseCamera.visibility == "public",
    ]
    if status != "all":
        conditions.append(HouseCamera.moderation_status == status)
    for column, value in (
        (HouseCamera.house_id, house_id),
        (HouseCamera.entrance, entrance),
        (HouseCamera.floor, floor),
        (HouseCamera.zone, zone),
    ):
        if value is not None:
            conditions.append(column == value)
    total = await session.scalar(select(func.count()).select_from(HouseCamera).where(*conditions))
    rows = await session.execute(
        select(HouseCamera, House, User)
        .join(
            House,
            House.id == HouseCamera.house_id,
        )
        .outerjoin(User, User.id == HouseCamera.owner_id)
        .where(*conditions)
        .order_by(
            HouseCamera.id.desc(),
        )
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return StaffCameraPage(
        items=[
            StaffCameraResponse(
                **camera_response(camera, None).model_dump(),
                house_id=house.id,
                address=house.address,
                owner_name=owner.name if owner else "Камера дома",
                source_url=camera.preview_url,
            )
            for camera, house, owner in rows
        ],
        total=total or 0,
    )


async def moderate_camera(
    session: AsyncSession,
    staff_id: int,
    camera_id: int,
    data: ModerateCamera,
):
    camera = await session.scalar(
        select(HouseCamera)
        .where(
            HouseCamera.id == camera_id,
            HouseCamera.deleted_at.is_(None),
            HouseCamera.house_id.in_(house_scope(staff_id)),
            HouseCamera.owner_id.is_not(None),
            HouseCamera.visibility == "public",
        )
        .with_for_update()
    )
    if camera is None:
        raise HTTPException(404, "Камера не найдена или недоступна")
    reason = data.reason if data.decision == "rejected" else None
    if camera.moderation_status != "pending":
        if camera.moderation_status == data.decision and camera.moderation_reason == reason:
            return camera_response(camera, None)
        raise HTTPException(409, "Решение по этой камере уже принято. Обновите список")
    camera.moderation_status = data.decision
    camera.moderation_reason = reason
    camera.reviewed_by = staff_id
    camera.reviewed_at = datetime.now(UTC)
    await session.commit()
    return camera_response(camera, None)


async def delete_camera(session: AsyncSession, staff_id: int, camera_id: int):
    camera = await session.scalar(
        select(HouseCamera)
        .where(
            HouseCamera.id == camera_id,
            HouseCamera.house_id.in_(house_scope(staff_id)),
            HouseCamera.visibility == "public",
        )
        .with_for_update()
    )
    if camera is None:
        raise HTTPException(404, "Камера не найдена или недоступна")
    if camera.deleted_at is None:
        # Keep the record so demo provisioning cannot recreate a removed camera.
        camera.deleted_at = datetime.now(UTC)
        await session.commit()
