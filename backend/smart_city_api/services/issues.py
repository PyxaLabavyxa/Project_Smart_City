import hashlib
from datetime import UTC, datetime

from app.database.enums import ISSUE_CATEGORIES_BY_SCOPE, IssueStatus
from app.database.models import Apartment, House, Issue, IssueEvent, IssuePhoto, StaffNotification
from app.services.inbox import issue_created
from fastapi import HTTPException
from sqlalchemy import and_, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.app import CreateIssue, IssueHistory, IssueResponse, Location
from smart_city_api.services.access import own_apartment_ids, require_house
from smart_city_api.services.issue_priority import IssuePriorityClassifier
from smart_city_api.services.locations import OUTDOOR_ZONES, validate_location

CATEGORIES_BY_SCOPE = ISSUE_CATEGORIES_BY_SCOPE


def visible_issues(user_id: int, apartment_id: int | None = None):
    """Resident visibility; unknown legacy locations stay author-only."""
    apartments = select(Apartment.id).where(
        Apartment.id.in_(own_apartment_ids(user_id)),
        Apartment.house_id == Issue.house_id,
    )
    if apartment_id is not None:
        apartments = apartments.where(Apartment.id == apartment_id)
    entrance_zones = ("entrance", "corridor", "stairs", "elevator", "technical")
    shared_zones = OUTDOOR_ZONES | set(entrance_zones)
    return and_(
        Issue.rejected_at.is_(None),
        Issue.deleted_at.is_(None),
        apartments.exists(),
        or_(
            and_(
                Issue.user_id == user_id,
                or_(
                    Issue.apartment_id.is_not(None),
                    Issue.zone.is_(None),
                    Issue.zone.not_in(shared_zones),
                ),
            ),
            and_(
                Issue.apartment_id.is_(None),
                or_(
                    Issue.zone.in_(OUTDOOR_ZONES),
                    and_(
                        Issue.zone.in_(entrance_zones),
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
    *,
    priority_classifier: IssuePriorityClassifier,
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
        if existing.deleted_at is not None:
            raise HTTPException(
                409, "Обращение удалено. Для нового обращения отправьте новую заявку"
            )
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
    # End the read-only transaction before waiting on an external service.
    # In particular, do not occupy a DB connection for the AI deadline.
    await session.rollback()
    priority = await priority_classifier.classify(data)
    # Access/location and concurrent retries may have changed while AI was running.
    house = await require_house(session, user_id, house_id)
    await validate_location(session, user_id, house, place)
    existing = await session.scalar(statement)
    if existing:
        check_retry(existing)
        return await issue_response(session, existing, house, user_id)
    issue = Issue(
        user_id=user_id,
        house_id=house_id,
        title=data.title,
        description=data.description,
        category=data.category,
        status=IssueStatus.NEW,
        priority=priority,
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
        await issue_created(session, issue)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        existing = await session.scalar(statement)
        if existing is None:
            raise
        check_retry(existing)
        return await get_issue(session, user_id, existing.id)
    return await issue_response(session, issue, house, user_id)


async def delete_issue(session: AsyncSession, user_id: int, issue_id: int) -> None:
    issue = await session.scalar(
        select(Issue)
        .where(Issue.id == issue_id, Issue.user_id == user_id, Issue.rejected_at.is_(None))
        .with_for_update()
    )
    if issue is None:
        raise HTTPException(404, "Обращение не найдено")
    await require_house(session, user_id, issue.house_id)
    if issue.deleted_at is not None:
        return
    accepted_before = await session.scalar(
        select(IssueEvent.id)
        .where(IssueEvent.issue_id == issue_id, IssueEvent.status != IssueStatus.NEW.value)
        .limit(1)
    )
    if issue.status != IssueStatus.NEW or accepted_before is not None:
        raise HTTPException(409, "Обращение уже принято в работу — удалить его нельзя")
    now = datetime.now(UTC)
    # Conditional update also guards status races on databases without row locks.
    changed = await session.execute(
        update(Issue)
        .where(
            Issue.id == issue_id,
            Issue.status == IssueStatus.NEW,
            Issue.rejected_at.is_(None),
            Issue.deleted_at.is_(None),
        )
        .values(deleted_at=now)
    )
    if changed.rowcount != 1:
        await session.rollback()
        raise HTTPException(409, "Обращение уже изменено. Обновите страницу")
    await session.execute(
        update(StaffNotification)
        .where(StaffNotification.issue_id == issue_id, StaffNotification.sent_at.is_(None))
        .values(suppressed_at=now, lease_token=None)
    )
    await session.commit()
