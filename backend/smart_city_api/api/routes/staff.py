import asyncio
import re
from pathlib import Path
from typing import Annotated

from app.database.enums import IssuePriority, IssueStatus
from app.database.models import House, IssuePhoto, StaffSession
from app.paths import project_path
from fastapi import APIRouter, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse
from sqlalchemy import delete, select

from smart_city_api.api.dependencies import Session
from smart_city_api.core.staff_auth import (
    COOKIE,
    COOKIE_PATH,
    Staff,
    authenticate,
    check_login_limit,
    create_session,
    csrf_token,
    require_same_origin,
    token_hash,
)
from smart_city_api.schemas.staff import (
    ActionOutput,
    HouseOutput,
    IssueDetail,
    LoginInput,
    MessageInput,
    ProfileOutput,
    StaffIssuePage,
    StatusInput,
)
from smart_city_api.services import staff as service

router = APIRouter(prefix="/api/v1/staff", tags=["Staff"])


@router.post("/auth/login", status_code=204)
async def login(body: LoginInput, request: Request, response: Response, session: Session):
    require_same_origin(request)
    await check_login_limit(
        session, body.login, request.client.host if request.client else "unknown"
    )
    employee = await authenticate(session, body.login, body.password.get_secret_value())
    old_token = request.cookies.get(COOKIE)
    if old_token:
        await session.execute(
            delete(StaffSession).where(StaffSession.token_hash == token_hash(old_token))
        )
    settings = request.app.state.settings
    token = await create_session(session, employee.id, settings.staff_session_hours)
    response.set_cookie(
        COOKIE,
        token,
        max_age=settings.staff_session_hours * 3600,
        path=COOKIE_PATH,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="strict",
    )


@router.post("/auth/logout", status_code=204)
async def logout(request: Request, response: Response, session: Session, employee: Staff):
    await session.execute(
        delete(StaffSession).where(
            StaffSession.token_hash == token_hash(request.cookies[COOKIE]),
            StaffSession.staff_id == employee.id,
        )
    )
    await session.commit()
    response.delete_cookie(
        COOKIE,
        path=COOKIE_PATH,
        secure=request.app.state.settings.session_cookie_secure,
        httponly=True,
        samesite="strict",
    )


@router.get("/me", response_model=ProfileOutput)
async def profile(request: Request, session: Session, employee: Staff):
    houses = (
        await session.scalars(
            select(House)
            .where(House.id.in_(service.house_scope(employee.id)))
            .order_by(House.address)
        )
    ).all()
    return ProfileOutput(
        name=employee.name,
        houses=[HouseOutput(id=h.id, address=h.address) for h in houses],
        csrf_token=csrf_token(request.cookies[COOKIE]),
    )


@router.get("/issues", response_model=StaffIssuePage)
async def issues(
    session: Session,
    employee: Staff,
    house_id: int | None = None,
    status: IssueStatus | None = None,
    priority: IssuePriority | None = None,
    q: Annotated[str, Query(max_length=200)] = "",
    page: Annotated[int, Query(ge=1, le=100000)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 25,
):
    return await service.list_issues(
        session, employee.id, house_id, status, priority, q, page, page_size
    )


@router.get("/issues/{issue_id}", response_model=IssueDetail)
async def issue_detail(issue_id: int, session: Session, employee: Staff):
    return await service.detail(session, employee.id, issue_id)


@router.post("/issues/{issue_id}/status", response_model=ActionOutput)
async def update_status(issue_id: int, body: StatusInput, session: Session, employee: Staff):
    return await service.perform_action(session, employee, issue_id, body)


@router.post("/issues/{issue_id}/messages", response_model=ActionOutput)
async def send_message(issue_id: int, body: MessageInput, session: Session, employee: Staff):
    return await service.perform_action(session, employee, issue_id, body)


def photo_path(root: Path, key: str) -> Path:
    if not re.fullmatch(r"issues/[0-9a-f]{32}\.(jpg|png|webp)", key):
        raise FileNotFoundError
    root = root.resolve()
    path = (root / key).resolve()
    if not path.is_relative_to(root) or not path.is_file():
        raise FileNotFoundError
    return path


@router.get("/photos/{photo_id}", response_class=FileResponse)
async def photo(photo_id: int, request: Request, session: Session, employee: Staff):
    record = await session.get(IssuePhoto, photo_id)
    if record is None:
        raise HTTPException(404, "Фотография не найдена")
    await service.accessible_issue(session, employee.id, record.issue_id)
    try:
        path = await asyncio.to_thread(
            photo_path, project_path(request.app.state.settings.media_root), record.file_path
        )
    except (OSError, ValueError):
        raise HTTPException(404, "Фотография недоступна в хранилище") from None
    types = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}
    return FileResponse(
        path,
        media_type=types[path.suffix],
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )
