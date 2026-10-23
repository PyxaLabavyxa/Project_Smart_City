"""Staff intake: authorize the house, reporter and location in one transaction."""

import hashlib

from app.database.enums import ISSUE_CATEGORIES_BY_SCOPE, IssuePriority, IssueStatus
from app.database.models import Apartment, House, Issue, IssueEvent, User, UserApartment
from app.services.inbox import issue_created
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from smart_city_api.schemas.staff import (
    ReportApartment,
    ReportResident,
    StaffCreateIssue,
    StaffIssueOptions,
)
from smart_city_api.services.locations import OUTDOOR_ZONES, validate_location
from smart_city_api.services.resident_search import matches_resident
from smart_city_api.services.staff import detail, house_scope


async def report_house(session, staff_id, house_id):
    house = await session.scalar(
        select(House).where(House.id == house_id, House.id.in_(house_scope(staff_id)))
    )
    if house is None:
        raise HTTPException(404, "Дом не найден или недоступен")
    return house


async def issue_options(session, staff_id, house_id):
    await report_house(session, staff_id, house_id)
    apartments = await session.scalars(
        select(Apartment).where(Apartment.house_id == house_id).order_by(Apartment.number)
    )
    return StaffIssueOptions(
        apartments=[ReportApartment.model_validate(a, from_attributes=True) for a in apartments],
        categories={
            key: sorted(values)
            for key, values in ISSUE_CATEGORIES_BY_SCOPE.items()
            if key != "unknown"
        },
    )


async def report_residents(session, staff_id, house_id, query, page):
    house = await report_house(session, staff_id, house_id)
    rows = await session.execute(
        select(User, Apartment)
        .join(UserApartment, UserApartment.user_id == User.id)
        .join(Apartment, Apartment.id == UserApartment.apartment_id)
        .where(Apartment.house_id == house_id)
        .order_by(User.name, User.id, Apartment.number)
    )
    people = {}
    for user, apartment in rows:
        person = people.setdefault(user.id, {"user": user, "apartments": []})
        person["apartments"].append(apartment)
    found = [
        person
        for person in people.values()
        if matches_resident(
            query,
            person["user"].name,
            person["user"].max_user_id,
            [(house.address, a.number) for a in person["apartments"]],
        )
    ]
    return {
        "total": len(found),
        "items": [
            ReportResident(
                id=person["user"].id,
                name=person["user"].name,
                apartments=[
                    ReportApartment.model_validate(a, from_attributes=True)
                    for a in person["apartments"]
                ],
            )
            for person in found[(page - 1) * 20 : page * 20]
        ],
    }


async def create_staff_issue(session, staff_id, data: StaffCreateIssue):
    house = await report_house(session, staff_id, data.house_id)
    # Preserve retry hashes made before staff intake supported explicit priority.
    excluded = (
        {"request_id", "priority"} if data.priority == IssuePriority.MEDIUM else {"request_id"}
    )
    fingerprint = hashlib.sha256(data.model_dump_json(exclude=excluded).encode()).hexdigest()
    prior_query = select(Issue).where(
        Issue.created_by_staff_id == staff_id, Issue.staff_request_id == str(data.request_id)
    )

    async def retry(previous):
        if previous.staff_request_hash != fingerprint:
            raise HTTPException(409, "Этот запрос уже использован для другого обращения")
        return await detail(session, staff_id, previous.id)

    previous = await session.scalar(prior_query)
    if previous is not None:
        return await retry(previous)
    author = None
    if data.resident_id is not None:
        author = await session.scalar(
            select(User).where(
                User.id == data.resident_id,
                User.id.in_(
                    select(UserApartment.user_id)
                    .join(Apartment, Apartment.id == UserApartment.apartment_id)
                    .where(Apartment.house_id == house.id)
                ),
            )
        )
        if author is None:
            raise HTTPException(422, "Выберите жителя этого дома")
    caller_apartment = None
    if data.reporter_apartment_id is not None:
        query = select(Apartment).where(
            Apartment.id == data.reporter_apartment_id, Apartment.house_id == house.id
        )
        if author is not None:
            query = query.where(
                Apartment.id.in_(
                    select(UserApartment.apartment_id).where(UserApartment.user_id == author.id)
                )
            )
        caller_apartment = await session.scalar(query)
        if caller_apartment is None:
            raise HTTPException(
                422, "Квартира заявителя не соответствует выбранному дому или жителю"
            )
    await validate_location(session, data.resident_id, house, data.place)
    scope = (
        "courtyard"
        if data.place.zone in OUTDOOR_ZONES
        else "apartment"
        if data.place.zone == "apartment"
        else "entrance"
    )
    if data.category not in ISSUE_CATEGORIES_BY_SCOPE[scope]:
        raise HTTPException(422, "Категория недоступна для выбранного места")
    issue = Issue(
        user_id=data.resident_id,
        house_id=house.id,
        created_by_staff_id=staff_id,
        staff_request_id=str(data.request_id),
        staff_request_hash=fingerprint,
        reporter_name=author.name if author else data.reporter_name,
        reporter_phone=data.reporter_phone,
        reporter_apartment=caller_apartment.number if caller_apartment else None,
        title=data.title,
        description=data.description,
        category=data.category,
        priority=data.priority,
        status=IssueStatus.NEW,
        **data.place.model_dump(),
    )
    try:
        session.add(issue)
        await session.flush()
        session.add(IssueEvent(issue_id=issue.id, status="new", created_at=issue.created_at))
        await issue_created(session, issue, staff_id=staff_id)
        await session.commit()
    except IntegrityError:
        await session.rollback()
        previous = await session.scalar(prior_query)
        if previous is None:
            raise
        return await retry(previous)
    return await detail(session, staff_id, issue.id)
