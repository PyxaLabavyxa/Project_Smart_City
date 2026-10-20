from typing import Annotated

from fastapi import APIRouter, Query

from smart_city_api.api.dependencies import Session
from smart_city_api.core.staff_auth import Staff
from smart_city_api.schemas.house_chats import (
    AnnouncementInput,
    AnnouncementOutput,
    AnnouncementPage,
    ChatOutput,
    ConnectionCode,
    ResidentPage,
    VersionInput,
)
from smart_city_api.services import house_chats as service

router = APIRouter(prefix="/api/v1/staff", tags=["Staff chats"])


@router.get("/announcement-residents", response_model=ResidentPage)
async def residents(
    session: Session,
    employee: Staff,
    q: Annotated[str, Query(max_length=100)] = "",
    page: Annotated[int, Query(ge=1, le=10000)] = 1,
):
    return await service.resident_choices(session, employee.id, q, page)


@router.get("/max-chats", response_model=list[ChatOutput])
async def chats(session: Session, employee: Staff):
    return await service.list_chats(session, employee.id)


@router.post("/max-chats/{house_id}/code", response_model=ConnectionCode)
async def connection(house_id: int, session: Session, employee: Staff):
    return await service.connection_code(session, employee.id, house_id)


@router.post("/max-chats/{house_id}/disconnect", status_code=204)
async def disconnect(house_id: int, session: Session, employee: Staff):
    await service.disconnect(session, employee.id, house_id)


@router.post("/max-chats/{house_id}/menu", status_code=204)
async def menu(house_id: int, session: Session, employee: Staff):
    await service.restore_menu(session, employee.id, house_id)


@router.get("/announcements", response_model=AnnouncementPage)
async def announcements(
    session: Session, employee: Staff, page: Annotated[int, Query(ge=1, le=100000)] = 1
):
    return await service.list_announcements(session, employee.id, page)


@router.post("/announcements", response_model=AnnouncementOutput, status_code=201)
async def create(data: AnnouncementInput, session: Session, employee: Staff):
    return await service.save_draft(session, employee.id, data)


@router.get("/announcements/{announcement_id}", response_model=AnnouncementOutput)
async def detail(announcement_id: int, session: Session, employee: Staff):
    return await service.read_announcement(session, employee.id, announcement_id)


@router.put("/announcements/{announcement_id}", response_model=AnnouncementOutput)
async def edit(announcement_id: int, data: AnnouncementInput, session: Session, employee: Staff):
    return await service.save_draft(session, employee.id, data, announcement_id)


@router.post("/announcements/{announcement_id}/send", response_model=AnnouncementOutput)
async def send(announcement_id: int, data: VersionInput, session: Session, employee: Staff):
    return await service.publish(session, employee.id, announcement_id, data.version)


@router.post("/announcements/{announcement_id}/retry", response_model=AnnouncementOutput)
async def retry(announcement_id: int, session: Session, employee: Staff):
    return await service.retry_failed(session, employee.id, announcement_id)
