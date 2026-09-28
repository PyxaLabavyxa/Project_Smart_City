from datetime import datetime
from zoneinfo import ZoneInfo

from app.database.models import Invoice, Meter, MeterReading, UtilityAccount
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.app import AccountResponse, MeterResponse, ReadingInput
from smart_city_api.services.access import require_apartment


async def load_account(
    session: AsyncSession, user_id: int, apartment_id: int
) -> AccountResponse | None:
    await require_apartment(session, user_id, apartment_id)
    account = await session.scalar(
        select(UtilityAccount).where(
            UtilityAccount.apartment_id == apartment_id,
        )
    )
    if account is None:
        return None
    invoice = await session.scalar(
        select(Invoice)
        .where(
            Invoice.account_id == account.id,
        )
        .order_by(Invoice.period.desc())
        .limit(1)
    )
    rows = (
        await session.execute(
            select(Meter, MeterReading.value)
            .outerjoin(
                MeterReading,
                (MeterReading.meter_id == Meter.id)
                & (MeterReading.period == account.reading_period),
            )
            .where(Meter.account_id == account.id)
            .order_by(Meter.id)
        )
    ).all()
    return AccountResponse(
        number=account.number,
        area=account.area,
        residents=account.residents,
        invoiceNumber=invoice.number if invoice else None,
        period=invoice.period if invoice else None,
        due=invoice.due if invoice else None,
        readingPeriod=account.reading_period,
        charges=invoice.charges if invoice else [],
        meters=[
            MeterResponse(
                id=str(meter.id),
                kind=meter.kind,
                serial=meter.serial,
                previous=meter.previous,
                current=value,
            )
            for meter, value in rows
        ],
    )


async def save_reading(
    session: AsyncSession, user_id: int, meter_id: int, data: ReadingInput
) -> AccountResponse:
    row = (
        await session.execute(
            select(Meter, UtilityAccount)
            .join(
                UtilityAccount,
                Meter.account_id == UtilityAccount.id,
            )
            .where(Meter.id == meter_id)
            .with_for_update()
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(404, "Счётчик не найден")
    meter, account = row
    await require_apartment(session, user_id, account.apartment_id)
    today = datetime.now(ZoneInfo("Europe/Moscow")).date()
    if (
        data.period != account.reading_period
        or not account.reading_open <= today <= account.reading_close
    ):
        raise HTTPException(409, "Приём показаний за этот период закрыт")
    if data.value < meter.previous:
        raise HTTPException(422, "Показание не может быть меньше предыдущего")
    existing = await session.scalar(
        select(MeterReading).where(
            MeterReading.meter_id == meter_id,
            MeterReading.period == data.period,
        )
    )
    if existing:
        if existing.value != data.value:
            raise HTTPException(
                409, "Показание уже передано. Для исправления обратитесь в поддержку"
            )
    else:
        session.add(
            MeterReading(meter_id=meter_id, user_id=user_id, period=data.period, value=data.value)
        )
        try:
            await session.commit()
        except IntegrityError as error:
            await session.rollback()
            raise HTTPException(409, "Показание за этот период уже передано") from error
    return await load_account(session, user_id, account.apartment_id)
