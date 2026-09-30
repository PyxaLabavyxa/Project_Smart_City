import asyncio
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
    StaffAuth,
    authenticate,
    check_login_limit,
    create_session,
    csrf_token,
    require_same_origin,
    token_hash,
)
from smart_city_api.schemas.contacts import ContactsInput, ContactsOutput
from smart_city_api.schemas.staff import (
    ActionOutput,
    HouseOutput,
    IssueDetail,
    LoginInput,
    MessageInput,
    ProfileOutput,
    StaffIssuePage,
    StaffTokenOutput,
    StatusInput,
)
from smart_city_api.services import staff as service
from smart_city_api.services.contacts import read_contacts, save_contacts, staff_house
from smart_city_api.services.photos import photo_path

router = APIRouter(prefix="/api/v1/staff", tags=["Staff"])


@router.get("/houses/{house_id}/contacts", response_model=ContactsOutput)
async def contacts(house_id: int, session: Session, employee: Staff):
    await staff_house(session, employee.id, house_id)
    return await read_contacts(session, house_id)


@router.post("/houses/{house_id}/contacts", response_model=ContactsOutput)
async def update_contacts(house_id: int, body: ContactsInput, session: Session, employee: Staff):
    return await save_contacts(session, employee.id, house_id, body)


async def authenticate_login(body: LoginInput, request: Request, session: Session):
    require_same_origin(request)
    await check_login_limit(
        session, body.login, request.client.host if request.client else "unknown"
    )
    return await authenticate(session, body.login, body.password.get_secret_value())


@router.post("/auth/login", status_code=204)
async def login(body: LoginInput, request: Request, response: Response, session: Session):
    employee = await authenticate_login(body, request, session)
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


@router.post("/auth/token", response_model=StaffTokenOutput)
async def access_token(body: LoginInput, request: Request, session: Session):
    employee = await authenticate_login(body, request, session)
    hours = request.app.state.settings.staff_session_hours
    token = await create_session(session, employee.id, hours)
    return StaffTokenOutput(access_token=token, expires_in=hours * 3600)


@router.post("/auth/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    session: Session,
    employee: Staff,
    authentication: StaffAuth,
):
    await session.execute(
        delete(StaffSession).where(
            StaffSession.token_hash == token_hash(authentication.token),
            StaffSession.staff_id == employee.id,
        )
    )
    await session.commit()
    if not authentication.via_bearer:
        response.delete_cookie(
            COOKIE,
            path=COOKIE_PATH,
            secure=request.app.state.settings.session_cookie_secure,
            httponly=True,
            samesite="strict",
        )


@router.get("/me", response_model=ProfileOutput)
async def profile(session: Session, employee: Staff, authentication: StaffAuth):
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
        csrf_token=csrf_token(authentication.token),
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


@router.get("/registrations")
async def registrations(session: Session, employee: Staff, page: Annotated[int, Query(ge=1)] = 1):
    from app.database.models import Apartment, ManagementCompany, RegistrationRequest
    from sqlalchemy import func

    scope = Apartment.house_id.in_(service.house_scope(employee.id))
    total = await session.scalar(
        select(func.count())
        .select_from(RegistrationRequest)
        .join(Apartment, Apartment.id == RegistrationRequest.apartment_id)
        .where(scope)
    )
    rows = (
        await session.execute(
            select(RegistrationRequest, Apartment, House, ManagementCompany)
            .join(Apartment, Apartment.id == RegistrationRequest.apartment_id)
            .join(House, House.id == Apartment.house_id)
            .join(ManagementCompany, ManagementCompany.id == RegistrationRequest.company_id)
            .where(scope)
            .order_by(RegistrationRequest.id.desc())
            .offset((page - 1) * 25)
            .limit(25)
        )
    ).all()
    return {
        "total": total,
        "items": [
            {
                "id": r.id,
                "full_name": r.full_name,
                "address": h.address,
                "apartment": a.number,
                "company": c.name,
                "status": r.status,
                "auto_approved": r.auto_approved,
                "source": r.source,
                "created_at": r.created_at,
                "decided_at": r.decided_at,
            }
            for r, a, h, c in rows
        ],
    }


@router.post("/registrations/{application_id}/{decision}")
async def decide_application(application_id: int, decision: str, session: Session, employee: Staff):
    from app.database.models import Apartment, RegistrationRequest
    from app.services.registration import decide_registration

    if decision not in ("approve", "reject"):
        raise HTTPException(422, "Выберите принять или отклонить")
    application = await session.scalar(
        select(RegistrationRequest)
        .join(Apartment, Apartment.id == RegistrationRequest.apartment_id)
        .where(
            RegistrationRequest.id == application_id,
            Apartment.house_id.in_(service.house_scope(employee.id)),
        )
        .with_for_update(of=RegistrationRequest)
    )
    if application is None:
        raise HTTPException(404, "Заявка не найдена")
    try:
        await decide_registration(
            session, application, approve=decision == "approve", staff_id=employee.id
        )
    except ValueError as error:
        raise HTTPException(409, str(error)) from error
    await session.commit()
    return {"status": application.status}
