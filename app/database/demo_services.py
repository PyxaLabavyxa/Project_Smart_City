"""Opt-in demo services for selected houses; preserve configured accounts and cameras."""

import calendar
from datetime import datetime, timedelta
from decimal import Decimal
from zoneinfo import ZoneInfo

from sqlalchemy import select

from app.database.camera_data import provision_cameras
from app.database.models import Apartment, Invoice, Meter, UtilityAccount


async def provision_demo_utilities(session, apartments):
    today = datetime.now(ZoneInfo("Europe/Moscow")).date()
    period = today.strftime("%Y-%m")
    for index, apartment in enumerate(apartments):
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

    await session.flush()


async def provision_demo_house_services(session, houses):
    for house in houses:
        await provision_cameras(session, house)
        apartments = list(
            await session.scalars(
                select(Apartment).where(Apartment.house_id == house.id).order_by(Apartment.number)
            )
        )
        await provision_demo_utilities(session, apartments)
