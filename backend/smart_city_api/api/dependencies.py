from collections.abc import AsyncIterator
from typing import Annotated

from app.database.models import User
from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.core.auth import InvalidLaunchData, validate_launch_data, validate_session
from smart_city_api.core.local_login import LOCAL_COOKIE, LOCAL_USER_MAX_ID, local_login_allowed
from smart_city_api.db.session import Database


async def get_session(request: Request) -> AsyncIterator[AsyncSession]:
    database: Database | None = request.app.state.database
    if database is None:
        raise HTTPException(status_code=503, detail="Database is not configured")
    async with database.sessions() as session:
        yield session


Session = Annotated[AsyncSession, Depends(get_session)]
bearer = HTTPBearer(auto_error=False, scheme_name="MAXLaunchData")


async def get_user(
    request: Request,
    session: Session,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> User:
    settings = request.app.state.settings
    local_cookie = request.cookies.get(LOCAL_COOKIE)
    if local_cookie and not credentials and local_login_allowed(request):
        if (
            request.method not in ("GET", "HEAD", "OPTIONS")
            and request.headers.get("origin") not in settings.cors_origins
        ):
            raise HTTPException(403, "Источник запроса не разрешён")
        try:
            max_id = validate_session(
                local_cookie, settings.local_session_secret.get_secret_value()
            )
            if max_id != LOCAL_USER_MAX_ID:
                raise InvalidLaunchData("Invalid local identity")
        except InvalidLaunchData as error:
            raise HTTPException(401, "Локальная сессия истекла. Войдите повторно") from error
        user = await session.scalar(select(User).where(User.max_user_id == LOCAL_USER_MAX_ID))
        if user is None:
            raise HTTPException(
                403, "Сначала создайте локального жителя командой scripts/seed_local.py"
            )
        return user
    cookie = request.cookies.get("dompulse_session")
    if not credentials and not cookie:
        raise HTTPException(401, "Откройте приложение из MAX")
    if not settings.bot_token:
        raise HTTPException(503, "Вход через MAX ещё не настроен")
    try:
        if credentials:
            max_id = validate_launch_data(
                credentials.credentials,
                settings.bot_token.get_secret_value(),
                settings.max_auth_age_seconds,
            )
        else:
            if (
                request.method not in ("GET", "HEAD", "OPTIONS")
                and request.headers.get("origin") not in settings.cors_origins
            ):
                raise HTTPException(403, "Источник запроса не разрешён")
            max_id = validate_session(cookie, settings.bot_token.get_secret_value())
    except InvalidLaunchData as error:
        raise HTTPException(401, "Сессия истекла. Откройте приложение заново из MAX") from error
    user = await session.scalar(select(User).where(User.max_user_id == max_id))
    if user is None:
        raise HTTPException(403, "Сначала зарегистрируйтесь в чатботе")
    return user


Resident = Annotated[User, Depends(get_user)]
