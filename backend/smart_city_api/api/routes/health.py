import asyncio
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.api.dependencies import get_session
from smart_city_api.schemas.health import HealthResponse

router = APIRouter(prefix="/health", tags=["Service health"])


@router.get("/live", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    return HealthResponse()


@router.get(
    "/ready", response_model=HealthResponse, responses={503: {"description": "DB unavailable"}}
)
async def readiness(session: Annotated[AsyncSession, Depends(get_session)]) -> HealthResponse:
    try:
        async with asyncio.timeout(3):
            await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, TimeoutError):
        raise HTTPException(status_code=503, detail="Database is unavailable") from None
    return HealthResponse()
