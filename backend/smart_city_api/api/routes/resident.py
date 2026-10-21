import asyncio
from typing import Annotated

from app.database.models import Apartment, House, Issue, IssuePhoto
from app.paths import project_path
from fastapi import APIRouter, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import ValidationError
from sqlalchemy import select
from starlette.datastructures import UploadFile

from smart_city_api.api.dependencies import Resident, Session
from smart_city_api.schemas.app import CreateIssue, IssuePage, IssueResponse, Profile
from smart_city_api.schemas.contacts import ContactsOutput
from smart_city_api.schemas.issue_chat import (
    IssueChatPresenceInput,
    IssueMessageInput,
    IssueMessageOutput,
    IssueMessagePage,
)
from smart_city_api.schemas.notifications import NotificationPreferences
from smart_city_api.schemas.resident import ApartmentPage, ApartmentResponse, HouseResponse
from smart_city_api.services import chat_photos
from smart_city_api.services.access import own_apartment_ids, require_house
from smart_city_api.services.contacts import read_contacts
from smart_city_api.services.issue_chat import own_issue, read_messages, send_message
from smart_city_api.services.issues import (
    create_issue,
    delete_issue,
    get_issue,
    issue_response,
    visible_issues,
)
from smart_city_api.services.photos import MAX_BYTES, MAX_PHOTOS, photo_path, save_photo
from smart_city_api.services.presence import update_presence

router = APIRouter(prefix="/api/v1", tags=["resident"])
Limit = Annotated[int, Query(ge=1, le=100)]
Cursor = Annotated[int, Query(ge=0)]


@router.get("/houses/{house_id}/contacts", response_model=ContactsOutput)
async def contacts(house_id: int, session: Session, user: Resident):
    await require_house(session, user.id, house_id)
    return await read_contacts(session, house_id)


@router.get("/me/notifications", response_model=NotificationPreferences)
async def notification_preferences(user: Resident):
    return {key: getattr(user, "notify_" + key) for key in NotificationPreferences.model_fields}


@router.post("/me/notifications", response_model=NotificationPreferences)
async def save_notification_preferences(
    data: NotificationPreferences, session: Session, user: Resident
):
    for key, value in data.model_dump().items():
        setattr(user, "notify_" + key, value)
    await session.commit()
    return data


@router.get("/me", response_model=Profile)
async def me(request: Request, session: Session, user: Resident):
    apartments = (
        await session.scalars(
            select(Apartment)
            .where(
                Apartment.id.in_(own_apartment_ids(user.id)),
            )
            .order_by(Apartment.house_id, Apartment.number)
        )
    ).all()
    houses = (
        await session.scalars(
            select(House)
            .where(
                House.id.in_({apartment.house_id for apartment in apartments}),
            )
            .order_by(House.id)
        )
    ).all()
    return Profile(
        id=user.id,
        name=user.name,
        apartments=[ApartmentResponse.model_validate(a, from_attributes=True) for a in apartments],
        houses=[HouseResponse.model_validate(h, from_attributes=True) for h in houses],
    )


@router.get("/houses/{house_id}/apartments", response_model=ApartmentPage)
async def apartments(
    house_id: int, session: Session, user: Resident, cursor: Cursor = 0, limit: Limit = 100
):
    await require_house(session, user.id, house_id)
    rows = (
        await session.scalars(
            select(Apartment)
            .where(
                Apartment.house_id == house_id,
                Apartment.id > cursor,
            )
            .order_by(Apartment.id)
            .limit(limit + 1)
        )
    ).all()
    return ApartmentPage(
        items=[ApartmentResponse.model_validate(a, from_attributes=True) for a in rows[:limit]],
        next_cursor=rows[limit - 1].id if len(rows) > limit else None,
    )


@router.get("/houses/{house_id}/issues", response_model=IssuePage)
async def issues(
    house_id: int, session: Session, user: Resident, cursor: Cursor = 0, limit: Limit = 100
):
    house = await require_house(session, user.id, house_id)
    rows = (
        await session.scalars(
            select(Issue)
            .where(
                Issue.house_id == house_id,
                Issue.id > cursor,
                visible_issues(user.id),
            )
            .order_by(Issue.id)
            .limit(limit + 1)
        )
    ).all()
    return IssuePage(
        items=[await issue_response(session, item, house, user.id) for item in rows[:limit]],
        next_cursor=rows[limit - 1].id if len(rows) > limit else None,
    )


@router.get("/issues/{issue_id}", response_model=IssueResponse)
async def detail(issue_id: int, session: Session, user: Resident):
    return await get_issue(session, user.id, issue_id)


@router.delete("/issues/{issue_id}", status_code=204)
async def remove_issue(issue_id: int, session: Session, user: Resident):
    """Удалить своё обращение, которое ещё не было принято в работу."""
    await delete_issue(session, user.id, issue_id)


@router.get("/issues/{issue_id}/messages", response_model=IssueMessagePage)
async def issue_messages(
    issue_id: int, session: Session, user: Resident, cursor: Cursor = 0, limit: Limit = 100
):
    """Переписка автора обращения с УК. Другим жильцам недоступна."""
    return await read_messages(session, user.id, issue_id, cursor, limit)


@router.post("/issues/{issue_id}/messages", response_model=IssueMessageOutput)
async def issue_message(issue_id: int, data: IssueMessageInput, session: Session, user: Resident):
    """Отправить сообщение в УК; повтор с тем же request_id не создаёт дубликат."""
    return await send_message(session, user, issue_id, data)


@router.post(
    "/issues/{issue_id}/messages/with-photos",
    response_model=IssueMessageOutput,
    openapi_extra=chat_photos.MULTIPART,
)
async def issue_message_photos(issue_id: int, request: Request, session: Session, user: Resident):
    await own_issue(session, user.id, issue_id)
    async with chat_photos.upload(request, IssueMessageInput) as (data, photos):
        return await send_message(session, user, issue_id, data, photos)


@router.post("/issues/{issue_id}/presence", status_code=204)
async def issue_presence(
    issue_id: int, data: IssueChatPresenceInput, session: Session, user: Resident
):
    """Присутствие автора в чате и подтверждение прочитанных сообщений."""
    await update_presence(
        session,
        user,
        data.client_id,
        data.sequence,
        data.active,
        issue_id=issue_id,
        last_message_id=data.last_message_id,
    )


@router.post("/houses/{house_id}/issues", response_model=IssueResponse, status_code=201)
async def report(house_id: int, data: CreateIssue, session: Session, user: Resident):
    return await create_issue(session, user.id, house_id, data)


@router.post(
    "/houses/{house_id}/issues/with-photos",
    response_model=IssueResponse,
    status_code=201,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["data", "photos"],
                        "properties": {
                            "data": {"type": "string", "description": "JSON-encoded CreateIssue"},
                            "photos": {
                                "type": "array",
                                "minItems": 1,
                                "maxItems": 10,
                                "items": {"type": "string", "format": "binary"},
                            },
                        },
                    },
                }
            },
        }
    },
)
async def report_with_photos(house_id: int, request: Request, session: Session, user: Resident):
    await require_house(session, user.id, house_id)
    root = project_path(request.app.state.settings.media_root)
    photos: list[tuple[str, str]] = []
    try:
        async with request.form(max_files=MAX_PHOTOS, max_fields=1, max_part_size=16_384) as form:
            try:
                data = CreateIssue.model_validate_json(form.get("data", ""))
            except (ValidationError, TypeError):
                raise HTTPException(422, "Проверьте поля обращения") from None
            files = form.getlist("photos")
            if not 1 <= len(files) <= MAX_PHOTOS or any(
                not isinstance(f, UploadFile) for f in files
            ):
                raise HTTPException(422, "Выберите от 1 до 10 фотографий")
            for file in files:
                if file.size is not None and file.size > MAX_BYTES:
                    raise HTTPException(422, "Размер одной фотографии не должен превышать 10 МБ")
                content = await file.read(MAX_BYTES + 1)
                photos.append(await asyncio.to_thread(save_photo, root, content))
            return await create_issue(session, user.id, house_id, data, photos)
    finally:
        if photos:
            async with request.app.state.database.sessions() as cleanup:
                retained = set(
                    await cleanup.scalars(
                        select(IssuePhoto.file_path).where(
                            IssuePhoto.file_path.in_([key for key, _ in photos])
                        )
                    )
                )
            for key, _ in photos:
                if key not in retained:
                    await asyncio.to_thread((root / key).unlink, missing_ok=True)


@router.get("/issues/{issue_id}/photos/{photo_id}", response_class=FileResponse)
async def resident_photo(
    issue_id: int, photo_id: int, request: Request, session: Session, user: Resident
):
    await get_issue(session, user.id, issue_id)
    photo = await session.get(IssuePhoto, photo_id)
    if photo is None or photo.issue_id != issue_id:
        raise HTTPException(404, "Фотография не найдена")
    try:
        path = await asyncio.to_thread(
            photo_path, project_path(request.app.state.settings.media_root), photo.file_path
        )
    except (OSError, ValueError):
        raise HTTPException(404, "Фотография недоступна") from None
    return FileResponse(
        path, headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}
    )
