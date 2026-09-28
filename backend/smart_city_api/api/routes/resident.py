from typing import Annotated

from app.database.models import Apartment, House, Issue
from fastapi import APIRouter, Query
from sqlalchemy import select

from smart_city_api.api.dependencies import Resident, Session
from smart_city_api.schemas.app import CreateIssue, IssuePage, IssueResponse, Profile
from smart_city_api.schemas.resident import ApartmentPage, ApartmentResponse, HouseResponse
from smart_city_api.services.access import own_apartment_ids, require_house
from smart_city_api.services.issues import create_issue, get_issue, issue_response, visible_issues

router = APIRouter(prefix="/api/v1", tags=["resident"])
Limit = Annotated[int, Query(ge=1, le=100)]
Cursor = Annotated[int, Query(ge=0)]


@router.get("/me", response_model=Profile)
async def me(session: Session, user: Resident):
    apartments = (
        await session.scalars(
            select(Apartment)
            .where(
                Apartment.id.in_(own_apartment_ids(user.id)),
            )
            .order_by(Apartment.house_id, Apartment.number)
        )
    ).all()
    houses = (
        await session.scalars(
            select(House)
            .where(
                House.id.in_({apartment.house_id for apartment in apartments}),
            )
            .order_by(House.id)
        )
    ).all()
    return Profile(
        id=user.id,
        name=user.name,
        apartments=[ApartmentResponse.model_validate(a, from_attributes=True) for a in apartments],
        houses=[HouseResponse.model_validate(h, from_attributes=True) for h in houses],
    )


@router.get("/houses/{house_id}/apartments", response_model=ApartmentPage)
async def apartments(
    house_id: int, session: Session, user: Resident, cursor: Cursor = 0, limit: Limit = 100
):
    await require_house(session, user.id, house_id)
    rows = (
        await session.scalars(
            select(Apartment)
            .where(
                Apartment.house_id == house_id,
                Apartment.id > cursor,
            )
            .order_by(Apartment.id)
            .limit(limit + 1)
        )
    ).all()
    return ApartmentPage(
        items=[ApartmentResponse.model_validate(a, from_attributes=True) for a in rows[:limit]],
        next_cursor=rows[limit - 1].id if len(rows) > limit else None,
    )


@router.get("/houses/{house_id}/issues", response_model=IssuePage)
async def issues(
    house_id: int, session: Session, user: Resident, cursor: Cursor = 0, limit: Limit = 100
):
    house = await require_house(session, user.id, house_id)
    rows = (
        await session.scalars(
            select(Issue)
            .where(
                Issue.house_id == house_id,
                Issue.id > cursor,
                visible_issues(user.id),
            )
            .order_by(Issue.id)
            .limit(limit + 1)
        )
    ).all()
    return IssuePage(
        items=[await issue_response(session, item, house, user.id) for item in rows[:limit]],
        next_cursor=rows[limit - 1].id if len(rows) > limit else None,
    )


@router.get("/issues/{issue_id}", response_model=IssueResponse)
async def detail(issue_id: int, session: Session, user: Resident):
    return await get_issue(session, user.id, issue_id)


@router.post("/houses/{house_id}/issues", response_model=IssueResponse, status_code=201)
async def report(house_id: int, data: CreateIssue, session: Session, user: Resident):
    return await create_issue(session, user.id, house_id, data)
