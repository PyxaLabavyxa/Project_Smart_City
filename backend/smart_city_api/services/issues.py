import hashlib

from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import Apartment, House, Issue, IssueEvent, IssuePhoto
from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.app import CreateIssue, IssueHistory, IssueResponse, Location
from smart_city_api.services.access import own_apartment_ids, require_house
from smart_city_api.services.locations import OUTDOOR_ZONES, validate_location

CATEGORIES_BY_SCOPE = {
    "courtyard": {
        IssueCategory.YARD,
        IssueCategory.GARBAGE,
        IssueCategory.ELECTRICITY,
        IssueCategory.WATER,
        IssueCategory.SECURITY,
        IssueCategory.OTHER,
    },
    "entrance": set(IssueCategory) - {IssueCategory.YARD},
    "apartment": {
        IssueCategory.WATER,
        IssueCategory.HEATING,
        IssueCategory.ELECTRICITY,
        IssueCategory.SECURITY,
        IssueCategory.OTHER,
    },
}


def visible_issues(user_id: int):
    """Resident visibility; unknown legacy locations stay author-only."""
    apartments = select(Apartment.id).where(
        Apartment.id.in_(own_apartment_ids(user_id)),
        Apartment.house_id == Issue.house_id,
    )
    return and_(
        Issue.rejected_at.is_(None),
        apartments.exists(),
        or_(
            Issue.user_id == user_id,
            and_(
                Issue.apartment_id.is_(None),
                or_(
                    Issue.zone.in_(OUTDOOR_ZONES),
                    and_(
                        Issue.zone.in_(
                            ("entrance", "corridor", "stairs", "elevator", "technical")
                        ),
                        apartments.where(Apartment.entrance == Issue.entrance).exists(),
                    ),
                ),
            ),
        ),
    )


async def issue_response(
    session: AsyncSession, issue: Issue, house: House, user_id: int
) -> IssueResponse:
    events = (
        await session.scalars(
            select(IssueEvent)
            .where(
                IssueEvent.issue_id == issue.id,
            )
            .order_by(IssueEvent.created_at, IssueEvent.id)
        )
    ).all()
    place = (
        Location(
            entrance=issue.entrance,
            floor=issue.floor,
            zone=issue.zone,
            apartment_id=issue.apartment_id,
        )
        if issue.zone
        else None
    )
    return IssueResponse(
        id=issue.id,
        house_id=house.id,
        title=issue.title,
        description=issue.description,
        category=issue.category,
        status=issue.status,
        priority=issue.priority.value,
        created_at=issue.created_at,
        mine=issue.user_id == user_id,
        address=house.address,
        place=place,
        history=[IssueHistory(status=event.status, at=event.created_at) for event in events],
        photo_ids=list(
            await session.scalars(
                select(IssuePhoto.id).where(IssuePhoto.issue_id == issue.id).order_by(IssuePhoto.id)
            )
        ),
    )


async def get_issue(session: AsyncSession, user_id: int, issue_id: int) -> IssueResponse:
    issue = await session.scalar(
        select(Issue).where(
            Issue.id == issue_id,
            visible_issues(user_id),
        )
    )
    if issue is None:
        raise HTTPException(404, "Обращение не найдено")
    house = await require_house(session, user_id, issue.house_id)
    return await issue_response(session, issue, house, user_id)


async def create_issue(
    session: AsyncSession,
    user_id: int,
    house_id: int,
    data: CreateIssue,
    photos: list[tuple[str, str]] | None = None,
) -> IssueResponse:
    house = await require_house(session, user_id, house_id)
    place = data.place
    outdoor = place.zone in OUTDOOR_ZONES
    await validate_location(session, user_id, house, place)
    fingerprint_data = f"{house_id}:{data.model_dump_json(exclude={'request_id'})}"
    legacy_fingerprint_data = None
    if outdoor:
        legacy = data.model_copy(
            update={"place": place.model_copy(update={"entrance": 1, "floor": 1})}
        )
        legacy_fingerprint_data = f"{house_id}:{legacy.model_dump_json(exclude={'request_id'})}"
    if photos:
        photo_fingerprint = ":photos:" + ":".join(digest for _, digest in photos)
        fingerprint_data += photo_fingerprint
        if legacy_fingerprint_data is not None:
            legacy_fingerprint_data += photo_fingerprint
    fingerprint = hashlib.sha256(fingerprint_data.encode()).hexdigest()
    retry_fingerprints = {fingerprint}
    if legacy_fingerprint_data is not None:
        retry_fingerprints.add(hashlib.sha256(legacy_fingerprint_data.encode()).hexdigest())
    statement = select(Issue).where(
        Issue.user_id == user_id, Issue.request_id == str(data.request_id)
    )

    def check_retry(existing: Issue):
        if existing.rejected_at is not None:
            raise HTTPException(
                409, "Обращение отклонено. Для нового обращения отправьте новую заявку"
            )
        if existing.request_hash not in retry_fingerprints:
            raise HTTPException(409, "Этот ключ запроса уже использован для другого обращения")

    existing = await session.scalar(statement)
    if existing:
        check_retry(existing)
        return await issue_response(session, existing, house, user_id)
    scope = "courtyard" if outdoor else "apartment" if place.zone == "apartment" else "entrance"
    if data.category not in CATEGORIES_BY_SCOPE[scope]:
        raise HTTPException(422, "Эта подкатегория недоступна для выбранного места")
    issue = Issue(
        user_id=user_id,
        house_id=house_id,
        title=data.title,
        description=data.description,
        category=data.category,
        status=IssueStatus.NEW,
        priority=IssuePriority.MEDIUM,
        entrance=place.entrance,
        floor=place.floor,
        zone=place.zone,
        apartment_id=place.apartment_id,
        request_id=str(data.request_id),
        request_hash=fingerprint,
    )
    try:
        session.add(issue)
        await session.flush()
        session.add_all(IssuePhoto(issue_id=issue.id, file_path=key) for key, _ in photos or [])
        session.add(
            IssueEvent(issue_id=issue.id, status=IssueStatus.NEW.value, created_at=issue.created_at)
        )
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(statement)
        if existing is None:
            raise
        check_retry(existing)
        return await get_issue(session, user_id, existing.id)
    return await issue_response(session, issue, house, user_id)
