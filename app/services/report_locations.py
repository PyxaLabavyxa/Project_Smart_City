"""Resolve AI suggestions against real apartments; never accept apartment IDs from AI."""

from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.schemas import ReportAnalysis
from app.database.enums import ISSUE_CATEGORIES_BY_SCOPE, IssueCategory, IssueScope
from app.database.models import Apartment, House, User, UserApartment


class ReportHome(BaseModel):
    apartment_id: int
    house_id: int
    address: str
    number: int
    entrance: int
    floor: int
    entrances: int
    floors: int


class ReportPlace(BaseModel):
    model_config = ConfigDict(extra="forbid")
    scope: IssueScope = IssueScope.UNKNOWN
    entrance: int | None = None
    floor: int | None = None
    zone: str | None = None
    apartment_id: int | None = None

    @property
    def ready(self) -> bool:
        return self.scope != IssueScope.UNKNOWN and (
            self.scope == IssueScope.COURTYARD
            or self.entrance is not None
            and self.floor is not None
        )


async def get_report_homes(session: AsyncSession, max_user_id: int) -> list[ReportHome]:
    rows = await session.execute(
        select(
            Apartment.id.label("apartment_id"),
            House.id.label("house_id"),
            House.address,
            Apartment.number,
            Apartment.entrance,
            Apartment.floor,
            House.entrances_count.label("entrances"),
            House.floors_count.label("floors"),
        )
        .select_from(Apartment)
        .join(House, House.id == Apartment.house_id)
        .join(UserApartment, UserApartment.apartment_id == Apartment.id)
        .join(User, User.id == UserApartment.user_id)
        .where(User.max_user_id == max_user_id)
        .order_by(House.id, Apartment.number)
    )
    return [ReportHome.model_validate(dict(row)) for row in rows.mappings()]


def suggest_place(home: ReportHome, analysis: ReportAnalysis) -> ReportPlace:
    scope = analysis.scope
    if scope == IssueScope.APARTMENT:
        return ReportPlace(
            scope=scope,
            entrance=home.entrance,
            floor=home.floor,
            zone="apartment",
            apartment_id=home.apartment_id,
        )
    if scope == IssueScope.COURTYARD:
        return ReportPlace(scope=scope, zone="courtyard")
    if scope == IssueScope.UNKNOWN:
        return ReportPlace()
    entrance = home.entrance if analysis.entrance is None else analysis.entrance
    if not 1 <= entrance <= home.entrances:
        entrance = None
    floor = analysis.floor
    if floor is not None and not 1 <= floor <= home.floors:
        floor = None
    if floor is None and home.floors == 1:
        floor = 1
    zone = analysis.zone or (
        "elevator" if analysis.category == IssueCategory.ELEVATOR else "corridor"
    )
    if zone == "entrance":
        # An explicitly mentioned entrance door is on floor 1; an entire stairwell is not.
        if floor is None:
            floor = 1
        elif floor != 1:
            zone = "corridor"
    return ReportPlace(scope=scope, entrance=entrance, floor=floor, zone=zone)


def validate_report_place(home: ReportHome, place: ReportPlace) -> ReportPlace:
    if place.scope == IssueScope.UNKNOWN:
        return ReportPlace()
    if place.scope == IssueScope.COURTYARD:
        return ReportPlace(scope=place.scope, zone="courtyard")
    if place.scope == IssueScope.APARTMENT:
        if place.apartment_id != home.apartment_id:
            raise ValueError("Выберите свою квартиру")
        return ReportPlace(
            scope=place.scope,
            entrance=home.entrance,
            floor=home.floor,
            zone="apartment",
            apartment_id=home.apartment_id,
        )
    if (
        not place.ready
        or not 1 <= place.entrance <= home.entrances
        or not 1 <= place.floor <= home.floors
    ):
        raise ValueError("Уточните подъезд и этаж в пределах выбранного дома")
    if (
        place.apartment_id is not None
        or place.zone
        not in {
            "corridor",
            "stairs",
            "elevator",
            "technical",
            "entrance",
        }
        or place.zone == "entrance"
        and place.floor != 1
    ):
        raise ValueError("Уточните место в подъезде")
    return place


def category_for_place(category: IssueCategory, place: ReportPlace) -> IssueCategory:
    allowed = ISSUE_CATEGORIES_BY_SCOPE.get(place.scope)
    return category if allowed is None or category in allowed else IssueCategory.OTHER
