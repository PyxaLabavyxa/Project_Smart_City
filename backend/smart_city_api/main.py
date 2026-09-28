from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError

from smart_city_api.api.router import router
from smart_city_api.api.routes.auth import router as auth_router
from smart_city_api.api.routes.resident import router as resident_router
from smart_city_api.api.routes.services import router as services_router
from smart_city_api.core.config import Settings
from smart_city_api.db.session import Database


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()

    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        database = (
            Database(settings.database_url.get_secret_value()) if settings.database_url else None
        )
        app.state.database = database
        try:
            yield
        finally:
            if database:
                await database.close()

    app = FastAPI(title=settings.app_name, version="0.1.0", lifespan=lifespan)
    app.state.settings = settings

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(SQLAlchemyError)
    async def database_error(request, exc):
        return JSONResponse(
            status_code=503,
            content={"detail": "Не удалось обратиться к базе данных. Повторите попытку"},
        )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST"],
        allow_headers=["Authorization", "Content-Type"],
    )
    app.include_router(router)
    app.include_router(auth_router)
    app.include_router(resident_router)
    app.include_router(services_router)
    return app


app = create_app()
