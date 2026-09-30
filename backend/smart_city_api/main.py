from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from app.database.registration_demo import seed_registration_demo
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.exc import SQLAlchemyError

from smart_city_api.api.router import router
from smart_city_api.api.routes.auth import router as auth_router
from smart_city_api.api.routes.registration import router as registration_router
from smart_city_api.api.routes.resident import router as resident_router
from smart_city_api.api.routes.services import router as services_router
from smart_city_api.api.routes.staff import router as staff_router
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
            if database and settings.onboarding_test_mode:
                async with database.sessions.begin() as session:
                    await seed_registration_demo(session)
            yield
        finally:
            if database:
                await database.close()

    app = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
        swagger_ui_oauth2_redirect_url="/api/docs/oauth2-redirect",
        swagger_ui_parameters={"filter": True, "displayRequestDuration": True},
    )
    app.state.settings = settings

    @app.get("/docs", include_in_schema=False)
    async def swagger_redirect():
        return RedirectResponse("/api/docs")

    @app.get("/redoc", include_in_schema=False)
    async def redoc_redirect():
        return RedirectResponse("/api/redoc")

    @app.get("/openapi.json", include_in_schema=False)
    async def openapi_redirect():
        return RedirectResponse("/api/openapi.json")

    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        if request.url.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        if request.url.path.startswith(("/staff", "/api/v1/staff")):
            response.headers["X-Content-Type-Options"] = "nosniff"
            response.headers["Referrer-Policy"] = "same-origin"
            response.headers["Content-Security-Policy"] = (
                "default-src 'self'; script-src 'self'; style-src 'self'; "
                "img-src 'self'; connect-src 'self'; frame-ancestors 'none'; "
                "base-uri 'none'; form-action 'self'"
            )
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
    app.include_router(staff_router)
    app.include_router(registration_router)
    app.mount(
        "/staff",
        StaticFiles(directory=Path(__file__).parent / "staff_web", html=True),
        name="staff",
    )
    return app


app = create_app()
