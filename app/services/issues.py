import asyncio
import logging

from app.ai.schemas import ReportAnalysis
from app.database.enums import IssueCategory, IssuePriority
from app.database.requests import create_issue, get_issue_author
from app.database.session import session_factory
from app.services.report_analysis import generate_issue_data
from app.services.report_locations import (
    ReportPlace,
    category_for_place,
    get_report_homes,
    suggest_place,
    validate_report_place,
)
from app.storage.photos import LocalPhotoStorage

logger = logging.getLogger(__name__)
AI_ANALYSIS_TIMEOUT_SECONDS = 30


async def analyze_report(description: str, report_model) -> ReportAnalysis:
    try:
        async with asyncio.timeout(AI_ANALYSIS_TIMEOUT_SECONDS):
            return await generate_issue_data(
                description=description, model=report_model
            )
    except Exception as exc:  # noqa: BLE001 -- SDK and validation errors share the same safe fallback.
        logger.warning(
            "Report analysis failed (%s); using default metadata", type(exc).__name__
        )
        return ReportAnalysis(
            title="Обращение жителя",
            category=IssueCategory.OTHER,
            priority=IssuePriority.MEDIUM,
        )


async def submit_issue(
    max_user_id: int,
    house_id: int,
    description: str,
    report_model,
    photo_storage: LocalPhotoStorage,
    photo_urls: list[str] | None = None,
    *,
    analysis: ReportAnalysis | None = None,
    apartment_id: int | None = None,
    place: ReportPlace | None = None,
) -> int:
    description = (description or "").strip()
    if not description or len(description) > 6000:
        raise ValueError("Нужно текстовое описание длиной от 1 до 6000 символов")

    async with session_factory() as session:
        await get_issue_author(session, max_user_id, house_id)

    if analysis is None:
        analysis = await analyze_report(description, report_model)

    paths = await photo_storage.save_many(photo_urls or [])
    try:
        async with session_factory.begin() as session:
            homes = [
                home
                for home in await get_report_homes(session, max_user_id)
                if home.house_id == house_id
            ]
            home = next(
                (home for home in homes if home.apartment_id == apartment_id), None
            )
            if apartment_id is not None and home is None:
                raise ValueError("Квартира больше не связана с вашим профилем")
            if home is None and len(homes) == 1:
                home = homes[0]
            if place is not None:
                if home is None or not place.ready:
                    raise ValueError("Выберите квартиру и место проблемы")
                location = validate_report_place(home, place)
            else:
                location = suggest_place(home, analysis) if home else ReportPlace()
                # Old callers have no clarification step: uncertainty stays author-only.
                if not location.ready:
                    location = ReportPlace()
            issue = await create_issue(
                session=session,
                max_user_id=max_user_id,
                house_id=house_id,
                description=description,
                title=analysis.title,
                category=category_for_place(analysis.category, location),
                priority=analysis.priority,
                photo_paths=paths,
                entrance=location.entrance,
                floor=location.floor,
                zone=location.zone,
                apartment_id=location.apartment_id,
            )
            issue_id = issue.id
    except Exception:
        await photo_storage.delete_many(paths)
        raise
    return issue_id
