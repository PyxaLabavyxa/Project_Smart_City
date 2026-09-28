from fastapi import APIRouter

from smart_city_api.api.routes.health import router as health_router

router = APIRouter()
router.include_router(health_router)
