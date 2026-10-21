import asyncio
import hashlib
import json
import re
from datetime import UTC, datetime
from urllib.parse import urlsplit

from app.database.models import House, HouseCamera, User
from app.paths import project_path
from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.core.camera_source import CameraSource
from smart_city_api.schemas.app import CameraFrame, CameraResponse, Location
from smart_city_api.schemas.cameras import (
    CameraSettings,
    CreateCamera,
    ModerateCamera,
    StaffCameraPage,
    StaffCameraResponse,
    StaffCreateCamera,
    UpdateCamera,
)
from smart_city_api.services import camera_media
from smart_city_api.services.access import require_house
from smart_city_api.services.contacts import staff_house
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
        source_type=camera.source_type,
        live_available=camera.source_config is not None and camera.source_type != "snapshot",
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


async def create_camera(
    session: AsyncSession, user_id: int, house_id: int, data: CreateCamera, settings
):
    house = await require_house(session, user_id, house_id)
    await validate_location(session, user_id, house, data.place)
    source = data.connection()
    values = {
        "house_id": house_id,
        "name": data.name,
        "note": data.note,
        "source_type": source.source_type,
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
        stored = (
            camera_media.decode(camera.source_config, settings).private_dict()
            if camera.source_config
            else {"source_url": camera.preview_url}
        )
        expected = data.connection().private_dict()
        if any(expected[key] != value for key, value in stored.items()):
            raise HTTPException(409, "Этот ключ запроса уже использован для другой камеры")
        return camera_response(camera, user_id)

    existing = await session.scalar(query)
    if existing:
        return previous(existing)
    await camera_media.frame(source, settings)
    values["source_type"] = source.source_type
    camera = HouseCamera(
        **values,
        owner_id=user_id,
        request_id=str(data.request_id),
        source_config=camera_media.encode(source, settings),
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


async def probe_camera(session, user_id, house_id, data, settings):
    await require_house(session, user_id, house_id)
    source = data.connection()
    if data.camera_id is not None:
        camera = await owned_camera(session, user_id, data.camera_id)
        if camera.house_id != house_id:
            raise HTTPException(404, "Камера не найдена")
        original = stored_source(camera, settings)
        if data.keep_password and original:
            source.password = original.password
    return await camera_media.probe(source, settings)


async def create_staff_camera(session, staff_id, data: StaffCreateCamera, settings):
    await staff_house(session, staff_id, data.house_id)
    house = await session.get(House, data.house_id)
    if data.place.zone == "apartment":
        raise HTTPException(422, "Камера УК должна находиться в общей зоне дома")
    await validate_location(session, None, house, data.place)
    source = data.connection()
    values = {
        "house_id": data.house_id,
        "name": data.name,
        "note": data.note,
        **data.place.model_dump(),
    }
    query = select(HouseCamera).where(
        HouseCamera.created_by_staff_id == staff_id,
        HouseCamera.request_id == str(data.request_id),
    )

    def previous(camera):
        if camera.deleted_at is not None:
            raise HTTPException(409, "Эта камера удалена. Создайте новую заявку")
        stored = camera_media.decode(camera.source_config, settings).private_dict()
        expected = source.private_dict()
        if stored != expected or any(
            getattr(camera, key) != value for key, value in values.items()
        ):
            raise HTTPException(409, "Этот ключ запроса уже использован для другой камеры")
        return camera_response(camera, None)

    existing = await session.scalar(query)
    if existing:
        return previous(existing)
    await camera_media.frame(source, settings)
    await staff_house(session, staff_id, data.house_id)
    camera = HouseCamera(
        **values,
        created_by_staff_id=staff_id,
        request_id=str(data.request_id),
        source_type=source.source_type,
        source_config=camera_media.encode(source, settings),
        status="online",
        visibility="public",
        moderation_status="approved",
        reviewed_by=staff_id,
        reviewed_at=datetime.now(UTC),
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
    return camera_response(camera, None)


async def accessible_camera(session: AsyncSession, user_id: int, camera_id: int):
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
    return camera


def camera_version(camera):
    values = [
        camera.name,
        camera.note,
        camera.source_config,
        camera.preview_url,
        camera.visibility,
        camera.moderation_status,
        camera.moderation_reason,
        str(camera.reviewed_at),
        str(camera.deleted_at),
    ]
    return hashlib.sha256(json.dumps(values, ensure_ascii=False).encode()).hexdigest()


async def owned_camera(session, user_id, camera_id, *, lock=False):
    query = select(HouseCamera).where(
        HouseCamera.id == camera_id,
        HouseCamera.owner_id == user_id,
        HouseCamera.deleted_at.is_(None),
    )
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    camera = await session.scalar(query)
    if camera is None:
        raise HTTPException(404, "Камера не найдена")
    await require_house(session, user_id, camera.house_id)
    return camera


def stored_source(camera, settings):
    if camera.source_config:
        return camera_media.decode(camera.source_config, settings)
    # Legacy owner-added HTTPS stills; demo photographs have no editable remote URL.
    if camera.preview_url and camera.preview_url.startswith("https://"):
        return CameraSource(source_url=camera.preview_url)
    return None


async def camera_settings(session, user_id, camera_id, settings):
    camera = await owned_camera(session, user_id, camera_id)
    source = stored_source(camera, settings)
    connection = (
        source.private_dict()
        if source
        else {
            "source_type": "snapshot",
            "source_url": "",
            "username": "",
            "password": "",
            "auth_type": "digest",
            "profile": "",
            "rtsp_port": None,
        }
    )
    password = connection.pop("password")
    return CameraSettings(
        **connection,
        id=str(camera.id),
        house_id=camera.house_id,
        name=camera.name,
        note=camera.note,
        password_set=bool(password),
        is_public=camera.visibility == "public",
        version=camera_version(camera),
    )


async def update_camera(session, user_id, camera_id, data: UpdateCamera, settings):
    camera = await owned_camera(session, user_id, camera_id)
    original = stored_source(camera, settings)
    source = data.connection()
    if data.keep_password and original:
        source.password = original.password
    visibility = "public" if data.is_public else "private"

    def unchanged(row):
        current = stored_source(row, settings)
        return (
            row.name == data.name
            and row.note == data.note
            and row.visibility == visibility
            and current is not None
            and current.private_dict() == source.private_dict()
        )

    if unchanged(camera):
        return camera_response(camera, user_id)
    if camera_version(camera) != data.expected_version:
        raise HTTPException(409, "Камера уже изменена. Откройте настройки заново")
    if original is None or original.private_dict() != source.private_dict():
        await camera_media.frame(source, settings)
    # Probe runs without a row lock; recheck under lock to avoid lost updates and
    # races with moderation/deletion while the camera was responding.
    camera = await owned_camera(session, user_id, camera_id, lock=True)
    if unchanged(camera):
        return camera_response(camera, user_id)
    if camera_version(camera) != data.expected_version:
        raise HTTPException(409, "Камера уже изменена. Откройте настройки заново")
    camera.name, camera.note, camera.visibility = data.name, data.note, visibility
    camera.source_type = source.source_type
    camera.source_config = camera_media.encode(source, settings)
    camera.preview_url = None
    camera.moderation_status = "pending" if data.is_public else "approved"
    camera.moderation_reason = camera.reviewed_at = camera.reviewed_by = None
    camera.captured_at = datetime.now(UTC)
    await session.commit()
    return camera_response(camera, user_id)


async def delete_owned_camera(session, user_id, camera_id):
    camera = await owned_camera(session, user_id, camera_id, lock=True)
    camera.deleted_at = datetime.now(UTC)
    await session.commit()


async def preview_camera(
    session: AsyncSession, user_id: int, camera_id: int, now: datetime, settings
):
    camera = await accessible_camera(session, user_id, camera_id)
    if camera.source_config:
        source = camera_media.decode(camera.source_config, settings)
        frame = await camera_media.frame(source, settings)
        return CameraFrame(src=camera_media.data_url(frame), capturedAt=now)
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
                owner_name=owner.name
                if owner
                else "Камера УК"
                if camera.created_by_staff_id
                else "Камера дома",
                source_url=camera.preview_url,
                connection_available=camera.source_config is not None,
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


async def staff_preview(session: AsyncSession, staff_id: int, camera_id: int, settings):
    camera = await session.scalar(
        select(HouseCamera).where(
            HouseCamera.id == camera_id,
            HouseCamera.deleted_at.is_(None),
            HouseCamera.house_id.in_(house_scope(staff_id)),
            HouseCamera.visibility == "public",
        )
    )
    if camera is None:
        raise HTTPException(404, "Камера не найдена")
    if not camera.source_config:
        if camera.preview_url and re.fullmatch(
            r"/images/cameras/(entrance-[12]|yard)-1\.png", camera.preview_url
        ):
            frame = int(datetime.now(UTC).timestamp() // 5) % 2 + 1
            path = project_path(
                "mini-app/public" + camera.preview_url.replace("-1.png", f"-{frame}.png")
            )
            if path.is_file():
                return await asyncio.to_thread(path.read_bytes)
        if camera.preview_url and camera.preview_url.startswith("https://"):
            return await camera_media.frame(CameraSource(source_url=camera.preview_url), settings)
        raise HTTPException(404, "Серверное подключение для этой камеры не настроено")
    return await camera_media.frame(camera_media.decode(camera.source_config, settings), settings)
