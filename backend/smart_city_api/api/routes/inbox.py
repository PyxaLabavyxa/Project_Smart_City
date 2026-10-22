from fastapi import APIRouter, Query

from smart_city_api.api.dependencies import Resident, Session
from smart_city_api.core.staff_auth import Staff
from smart_city_api.schemas.inbox import InboxCount, InboxPage, InboxReadAll
from smart_city_api.services import inbox

resident_router = APIRouter(prefix="/api/v1/me/inbox", tags=["resident notifications"])
staff_router = APIRouter(prefix="/api/v1/staff/inbox", tags=["staff notifications"])


@resident_router.get("", response_model=InboxPage)
async def resident_inbox(
    session: Session,
    user: Resident,
    before: int | None = Query(None, ge=1),
    limit: int = Query(30, ge=1, le=100),
    unread_only: bool = False,
):
    return await inbox.read_inbox(
        session, "user_id", user.id, before=before, limit=limit, unread_only=unread_only
    )


@resident_router.get("/count", response_model=InboxCount)
async def resident_count(session: Session, user: Resident):
    return {"unread_count": await inbox.count_unread(session, "user_id", user.id)}


@resident_router.post("/read-all", response_model=InboxCount)
async def resident_read_all(data: InboxReadAll, session: Session, user: Resident):
    return await inbox.mark_all_read(session, "user_id", user.id, data.through_id)


@resident_router.post("/{notification_id}/read", response_model=InboxCount)
async def resident_read(notification_id: int, session: Session, user: Resident):
    return await inbox.mark_read(session, "user_id", user.id, notification_id)


@staff_router.get("", response_model=InboxPage)
async def staff_inbox(
    session: Session,
    employee: Staff,
    before: int | None = Query(None, ge=1),
    limit: int = Query(30, ge=1, le=100),
    unread_only: bool = False,
):
    return await inbox.read_inbox(
        session, "staff_id", employee.id, before=before, limit=limit, unread_only=unread_only
    )


@staff_router.get("/count", response_model=InboxCount)
async def staff_count(session: Session, employee: Staff):
    return {"unread_count": await inbox.count_unread(session, "staff_id", employee.id)}


@staff_router.post("/read-all", response_model=InboxCount)
async def staff_read_all(data: InboxReadAll, session: Session, employee: Staff):
    return await inbox.mark_all_read(session, "staff_id", employee.id, data.through_id)


@staff_router.post("/{notification_id}/read", response_model=InboxCount)
async def staff_read(notification_id: int, session: Session, employee: Staff):
    return await inbox.mark_read(session, "staff_id", employee.id, notification_id)
