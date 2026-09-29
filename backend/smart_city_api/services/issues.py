import hashlib

from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import Apartment, House, Issue, IssueEvent, IssuePhoto
from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.app import CreateIssue, IssueHistory, IssueResponse, Location
from smart_city_api.services.access import own_apartment_ids, require_house


def visible_issues(user_id: int):
    return or_(
        Issue.apartment_id.is_(None),
        Issue.user_id == user_id,
        Issue.apartment_id.in_(own_apartment_ids(user_id)),
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
    if place.entrance > house.entrances_count or place.floor > house.floors_count:
        raise HTTPException(422, "Такого этажа или подъезда нет в доме")
    if place.zone in ("house", "courtyard", "parking") and (place.entrance, place.floor) != (1, 1):
        raise HTTPException(422, "Общая территория должна быть привязана к дому")
    if place.zone == "entrance" and place.floor != 1:
        raise HTTPException(422, "Входная группа находится на первом этаже")
    if place.floor > 1 and data.category in (IssueCategory.ENTRANCE, IssueCategory.YARD):
        raise HTTPException(422, "Категории «Подъезд» и «Двор» доступны только на первом этаже")
    if place.apartment_id:
        apartment = await session.scalar(
            select(Apartment).where(
                Apartment.id == place.apartment_id,
                Apartment.house_id == house_id,
                Apartment.entrance == place.entrance,
                Apartment.floor == place.floor,
                Apartment.id.in_(own_apartment_ids(user_id)),
            )
        )
        if apartment is None:
            raise HTTPException(422, "Выберите свою квартиру или общую зону")
    fingerprint_data = f"{house_id}:{data.model_dump_json(exclude={'request_id'})}"
    if photos:
        fingerprint_data += ":photos:" + ":".join(digest for _, digest in photos)
    fingerprint = hashlib.sha256(fingerprint_data.encode()).hexdigest()
    statement = select(Issue).where(
        Issue.user_id == user_id, Issue.request_id == str(data.request_id)
    )

    def check_retry(existing: Issue):
        if existing.request_hash != fingerprint:
            raise HTTPException(409, "Этот ключ запроса уже использован для другого обращения")

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
