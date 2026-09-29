import time
from datetime import UTC, datetime, timedelta
from uuid import UUID

from app.database.models import MiniAppPresence, User
from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from smart_city_api.api.dependencies import Resident, Session
from smart_city_api.core.auth import InvalidLaunchData, sign_session, validate_launch_data
from smart_city_api.core.local_login import LOCAL_COOKIE, LOCAL_USER_MAX_ID, local_login_allowed

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])


class LaunchInput(BaseModel):
    init_data: str = Field(min_length=1, max_length=16384)


@router.post("/max", status_code=204)
async def login(data: LaunchInput, request: Request, response: Response, session: Session):
    settings = request.app.state.settings
    if request.headers.get("origin") not in settings.cors_origins:
        raise HTTPException(403, "Источник запроса не разрешён")
    if not settings.bot_token:
        raise HTTPException(503, "Вход через MAX ещё не настроен")
    token = settings.bot_token.get_secret_value()
    try:
        max_id = validate_launch_data(data.init_data, token, settings.max_auth_age_seconds)
    except InvalidLaunchData as error:
        raise HTTPException(401, "Сессия истекла. Откройте приложение заново из MAX") from error
    if await session.scalar(select(User.id).where(User.max_user_id == max_id)) is None:
        raise HTTPException(403, "Сначала зарегистрируйтесь в чатботе")
    response.set_cookie(
        "dompulse_session",
        sign_session(max_id, token, int(time.time()) + 3600),
        max_age=3600,
        httponly=True,
        secure=settings.session_cookie_secure,
        samesite="none" if settings.session_cookie_secure else "lax",
        path="/api/v1",
    )
    response.headers["Cache-Control"] = "no-store"
    response.delete_cookie(LOCAL_COOKIE, path="/api/v1")


@router.post("/local", status_code=204)
async def local_login(request: Request, response: Response, session: Session):
    if not local_login_allowed(request):
        raise HTTPException(404, "Локальный вход выключен")
    settings = request.app.state.settings
    if request.headers.get("origin") not in settings.cors_origins:
        raise HTTPException(403, "Источник запроса не разрешён")
    if await session.scalar(select(User.id).where(User.max_user_id == LOCAL_USER_MAX_ID)) is None:
        raise HTTPException(
            403, "Сначала создайте локального жителя командой scripts/seed_local.py"
        )
    response.set_cookie(
        LOCAL_COOKIE,
        sign_session(
            LOCAL_USER_MAX_ID,
            settings.local_session_secret.get_secret_value(),
            int(time.time()) + 3600,
        ),
        max_age=3600,
        httponly=True,
        secure=False,
        samesite="strict",
        path="/api/v1",
    )
    response.delete_cookie("dompulse_session", path="/api/v1")


@router.post("/logout", status_code=204)
async def logout(request: Request, response: Response):
    if request.headers.get("origin") not in request.app.state.settings.cors_origins:
        raise HTTPException(403, "Источник запроса не разрешён")
    response.delete_cookie(LOCAL_COOKIE, path="/api/v1")
    response.delete_cookie("dompulse_session", path="/api/v1")


class PresenceInput(BaseModel):
    client_id: UUID
    sequence: int = Field(ge=1, le=2147483647)
    active: bool


@router.post("/presence", status_code=204)
async def presence(data: PresenceInput, session: Session, user: Resident):
    # Serialize updates for each resident; old heartbeat requests cannot reopen a closed tab.
    await session.scalar(select(User.id).where(User.id == user.id).with_for_update())
    now = datetime.now(UTC)
    await session.execute(
        delete(MiniAppPresence).where(
            MiniAppPresence.user_id == user.id,
            MiniAppPresence.expires_at < now - timedelta(days=1),
        )
    )
    key = (user.id, str(data.client_id))
    current = await session.get(MiniAppPresence, key)
    if current is None:
        current = MiniAppPresence(user_id=user.id, client_id=str(data.client_id), sequence=0)
        session.add(current)
    if data.sequence > current.sequence:
        current.sequence = data.sequence
        current.expires_at = now + timedelta(seconds=45) if data.active else now
    await session.commit()
