"""Opt-in sample records in PostgreSQL; never replace resident data."""

import calendar
from datetime import datetime, timedelta
from decimal import Decimal
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import case, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.camera_data import provision_cameras
from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import (
    Apartment,
    House,
    Invoice,
    Issue,
    IssueEvent,
    Meter,
    User,
    UserApartment,
    UtilityAccount,
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
    today = datetime.now(ZoneInfo("Europe/Moscow")).date()
    period = today.strftime("%Y-%m")
    for index, apartment in enumerate(apartments[:2]):
        account = await session.scalar(
            select(UtilityAccount).where(UtilityAccount.apartment_id == apartment.id)
        )
        if account is not None:
            continue  # Existing balances, readings and accounts are never overwritten.
        area = Decimal("54.20") if index == 0 else Decimal("38.60")
        account = UtilityAccount(
            apartment_id=apartment.id,
            number=f"LS-{apartment.id:06d}",
            area=area,
            residents=2 if index == 0 else 1,
            reading_period=period,
            reading_open=today.replace(day=1),
            reading_close=today.replace(day=calendar.monthrange(today.year, today.month)[1]),
        )
        session.add(account)
        await session.flush()
        for kind, previous in (("cold", "125.400"), ("hot", "82.100"), ("electricity", "3240.000")):
            session.add(
                Meter(
                    account_id=account.id,
                    kind=kind,
                    serial=f"LS-{apartment.id}-{kind}",
                    previous=Decimal(previous),
                )
            )
        charges = [
            {
                "title": "Содержание жилья",
                "quantity": f"{area} м²",
                "tariff": "32,50 ₽",
                "amount": int(area * 3250),
            },
            {"title": "Холодная вода", "quantity": "5 м³", "tariff": "48 ₽", "amount": 24000},
            {"title": "Горячая вода", "quantity": "3 м³", "tariff": "220 ₽", "amount": 66000},
            {"title": "Водоотведение", "quantity": "8 м³", "tariff": "36 ₽", "amount": 28800},
            {
                "title": "Электроэнергия",
                "quantity": "180 кВт·ч",
                "tariff": "6,50 ₽",
                "amount": 117000,
            },
            {
                "title": "Обращение с ТКО",
                "quantity": "1 услуга",
                "tariff": "320 ₽",
                "amount": 32000,
            },
            {
                "title": "Капитальный ремонт",
                "quantity": f"{area} м²",
                "tariff": "15 ₽",
                "amount": int(area * 1500),
            },
        ]
        next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=15)
        session.add(
            Invoice(
                account_id=account.id,
                number=f"КВ-{apartment.id}-{period}",
                period=period,
                due=next_month,
                charges=charges,
            )
        )
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
            description=("Лампа в коридоре не включается." if index == 0 else "В ванной подтекает кран."),
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
