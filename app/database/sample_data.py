"""Opt-in sample records in PostgreSQL; never replace resident data."""

from datetime import datetime, timedelta
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.camera_data import provision_cameras
from app.database.demo_services import provision_demo_utilities
from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import (
    Apartment,
    House,
    Issue,
    IssueEvent,
    User,
    UserApartment,
)

SAMPLE_HOUSE_ADDRESS = "ул. Садовая, 18"


async def provision_sample_resident(session: AsyncSession, user_id: int) -> None:
    # One allocation lock prevents assigning the same apartment to two residents.
    if session.bind.dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(71842026)"))
    await session.scalar(select(User).where(User.id == user_id).with_for_update())
    apartments = list(
        await session.scalars(
            select(Apartment)
            .join(UserApartment)
            .where(UserApartment.user_id == user_id)
            .order_by(Apartment.id)
        )
    )
    if len(apartments) < 2:
        house = await session.scalar(
            select(House).where(House.address == SAMPLE_HOUSE_ADDRESS).order_by(House.id).limit(1)
        )
        if house is None:
            house = House(
                address=SAMPLE_HOUSE_ADDRESS,
                entrances_count=2,
                floors_count=15,
                apartments_per_floor=4,
            )
            session.add(house)
            await session.flush()
        while len(apartments) < 2:
            occupied_entrances = {a.entrance for a in apartments if a.house_id == house.id}
            preferred = 1 if 1 not in occupied_entrances else 2
            available = list(
                await session.scalars(
                    select(Apartment)
                    .where(
                        Apartment.house_id == house.id,
                        ~Apartment.id.in_(select(UserApartment.apartment_id)),
                    )
                    .order_by(case((Apartment.entrance == preferred, 0), else_=1), Apartment.number)
                    .limit(1)
                )
            )
            if not available:
                last = (
                    await session.scalar(
                        select(func.max(Apartment.number)).where(Apartment.house_id == house.id)
                    )
                    or 0
                )
                size = house.floors_count * house.apartments_per_floor
                added = size * house.entrances_count if last == 0 else size
                for number in range(last + 1, last + added + 1):
                    session.add(
                        Apartment(
                            house_id=house.id,
                            number=number,
                            entrance=(number - 1) // size + 1,
                            floor=((number - 1) % size) // house.apartments_per_floor + 1,
                        )
                    )
                house.entrances_count = max(house.entrances_count, (last + added - 1) // size + 1)
                await session.flush()
                continue
            for apartment in available:
                session.add(UserApartment(user_id=user_id, apartment_id=apartment.id))
                apartments.append(apartment)
            await session.flush()
    for house_id in {apartment.house_id for apartment in apartments}:
        await provision_cameras(session, await session.get(House, house_id))
    await provision_demo_utilities(session, apartments[:2])
    for index, apartment in enumerate(apartments[:2]):
        request_id = str(uuid5(NAMESPACE_URL, f"dompulse:sample:{user_id}:{index}"))
        if await session.scalar(
            select(Issue.id).where(Issue.user_id == user_id, Issue.request_id == request_id)
        ):
            continue
        status = IssueStatus.NEW if index == 0 else IssueStatus.IN_PROGRESS
        created = datetime.now(ZoneInfo("Europe/Moscow")) - timedelta(days=2 - index)
        issue = Issue(
            user_id=user_id,
            house_id=apartment.house_id,
            title="Не горит свет на этаже" if index == 0 else "Протекает кран",
            description=(
                "Лампа в коридоре не включается." if index == 0 else "В ванной подтекает кран."
            ),
            category=IssueCategory.ELECTRICITY if index == 0 else IssueCategory.WATER,
            priority=IssuePriority.MEDIUM,
            status=status,
            entrance=apartment.entrance,
            floor=apartment.floor,
            zone="corridor" if index == 0 else "apartment",
            apartment_id=None if index == 0 else apartment.id,
            request_id=request_id,
            created_at=created,
        )
        session.add(issue)
        await session.flush()
        session.add(IssueEvent(issue_id=issue.id, status=IssueStatus.NEW.value, created_at=created))
        if status == IssueStatus.IN_PROGRESS:
            session.add(
                IssueEvent(
                    issue_id=issue.id, status=status.value, created_at=created + timedelta(hours=2)
                )
            )
    await session.flush()
