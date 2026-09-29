"""Independent, revocable employee sessions. No MAX/resident cookie grants staff access."""

import asyncio
import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from typing import Annotated
from urllib.parse import urlsplit

from app.database.models import StaffLoginThrottle, StaffSession, StaffUser
from fastapi import Depends, HTTPException, Request
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from smart_city_api.api.dependencies import Session

COOKIE = "dompulse_staff"
COOKIE_PATH = "/api/v1/staff"
PASSWORD_ITERATIONS = 600_000


def hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), bytes.fromhex(salt), PASSWORD_ITERATIONS
    ).hex()
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${salt}${digest}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, iterations, salt, expected = encoded.split("$")
        if algorithm != "pbkdf2_sha256" or not 600_000 <= int(iterations) <= 2_000_000:
            return False
        actual = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt), int(iterations)
        ).hex()
        return hmac.compare_digest(actual, expected)
    except (ValueError, TypeError):
        return False


# The nonexistent-account path still performs the same expensive password check.
DUMMY_HASH = f"pbkdf2_sha256${PASSWORD_ITERATIONS}${'00' * 16}${'00' * 32}"


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def csrf_token(token: str) -> str:
    return hmac.new(token.encode(), b"dompulse-staff-csrf-v1", hashlib.sha256).hexdigest()


def require_same_origin(request: Request) -> None:
    origin = request.headers.get("origin", "")
    # A TLS-terminating proxy may reach Uvicorn over HTTP. Accept its public HTTPS
    # origin only when explicitly configured AND the preserved Host matches it.
    try:
        configured_proxy_origin = (
            origin in request.app.state.settings.cors_origins
            and urlsplit(origin).scheme == "https"
            and urlsplit(origin).netloc == request.headers.get("host")
        )
    except ValueError:
        configured_proxy_origin = False
    if origin != str(request.base_url).rstrip("/") and not configured_proxy_origin:
        raise HTTPException(403, "Источник запроса не разрешён. Откройте кабинет заново")


async def check_login_limit(session: Session, login: str, address: str) -> None:
    now = datetime.now(UTC)
    window = int(now.timestamp()) // 900
    expires = datetime.fromtimestamp((window + 1) * 900, UTC)
    await session.execute(delete(StaffLoginThrottle).where(StaffLoginThrottle.expires_at <= now))
    insert = pg_insert if session.bind.dialect.name == "postgresql" else sqlite_insert
    over_limit = False
    # Atomic counters shared between API workers, including attempts for unknown accounts.
    for scope, limit in ((f"login:{login}", 10), (f"ip:{address}", 40)):
        stmt = insert(StaffLoginThrottle).values(
            key_hash=token_hash(f"{window}:{scope}"), attempts=1, expires_at=expires
        )
        count = await session.scalar(
            stmt.on_conflict_do_update(
                index_elements=["key_hash"],
                set_={"attempts": StaffLoginThrottle.attempts + 1},
            ).returning(StaffLoginThrottle.attempts)
        )
        over_limit |= count > limit
    await session.commit()
    if over_limit:
        raise HTTPException(
            429,
            "Слишком много попыток входа. Попробуйте через 15 минут",
            headers={"Retry-After": str(max(1, int((expires - now).total_seconds())))},
        )


async def authenticate(session: Session, login: str, password: str) -> StaffUser:
    employee = await session.scalar(
        select(StaffUser).where(StaffUser.login == login).with_for_update()
    )
    valid = await asyncio.to_thread(
        verify_password, password, employee.password_hash if employee else DUMMY_HASH
    )
    if not employee or not valid or not employee.active:
        raise HTTPException(401, "Неверный логин или пароль")
    return employee


async def create_session(session: Session, staff_id: int, hours: int) -> str:
    now = datetime.now(UTC)
    await session.execute(delete(StaffSession).where(StaffSession.expires_at <= now))
    token = secrets.token_urlsafe(32)
    session.add(
        StaffSession(
            staff_id=staff_id, token_hash=token_hash(token), expires_at=now + timedelta(hours=hours)
        )
    )
    await session.commit()
    return token


async def get_staff(request: Request, session: Session) -> StaffUser:
    token = request.cookies.get(COOKIE, "")
    if not token or len(token) > 100:
        raise HTTPException(401, "Войдите в кабинет сотрудника")
    employee = await session.scalar(
        select(StaffUser)
        .join(StaffSession, StaffSession.staff_id == StaffUser.id)
        .where(
            StaffSession.token_hash == token_hash(token),
            StaffSession.expires_at > datetime.now(UTC),
            StaffUser.active.is_(True),
        )
    )
    if employee is None:
        raise HTTPException(401, "Сессия истекла. Войдите повторно")
    if request.method not in ("GET", "HEAD", "OPTIONS"):
        require_same_origin(request)
        if not hmac.compare_digest(
            request.headers.get("x-csrf-token", "").encode(), csrf_token(token).encode()
        ):
            raise HTTPException(403, "Обновите страницу и повторите действие")
    return employee


Staff = Annotated[StaffUser, Depends(get_staff)]
