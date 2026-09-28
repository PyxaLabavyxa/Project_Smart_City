from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.database.session import create_tables, engine
from backend.routers.health import router as health_router


@asynccontextmanager
async def lifespan(application: FastAPI):
    try:
        await create_tables()
        yield
    finally:
        await engine.dispose()


app = FastAPI(title="Умный город — API", lifespan=lifespan)
app.include_router(health_router)
