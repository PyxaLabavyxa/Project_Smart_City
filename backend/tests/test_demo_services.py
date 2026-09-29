import asyncio
from decimal import Decimal

from app.database.models import (
    Apartment,
    Base,
    House,
    HouseCamera,
    Invoice,
    Issue,
    Meter,
    UserApartment,
    UtilityAccount,
)
from app.database.registration_demo import seed_registration_demo
from sqlalchemy import func, select

from smart_city_api.db.session import Database


def test_demo_services_cover_new_houses_and_preserve_existing_data(tmp_path):
    async def scenario():
        db = Database(f"sqlite+aiosqlite:///{tmp_path / 'services.db'}")
        try:
            async with db.engine.begin() as connection:
                await connection.run_sync(Base.metadata.create_all)
            async with db.sessions.begin() as session:
                await seed_registration_demo(session)
                camera = await session.scalar(select(HouseCamera).order_by(HouseCamera.id))
                camera.note = "Existing configured camera"
                camera_id = camera.id
                meter = await session.scalar(select(Meter).order_by(Meter.id))
                meter.previous = Decimal("777.123")
                meter_id = meter.id
                account = await session.scalar(select(UtilityAccount).order_by(UtilityAccount.id))
                account.number = "Existing account"
                account_id = account.id
            async with db.sessions.begin() as session:
                await seed_registration_demo(session)
            async with db.sessions() as session:
                apartments = await session.scalar(select(func.count()).select_from(Apartment))
                assert (
                    await session.scalar(select(func.count()).select_from(UtilityAccount))
                    == apartments
                )
                assert await session.scalar(select(func.count()).select_from(Invoice)) == apartments
                assert (
                    await session.scalar(select(func.count()).select_from(Meter)) == apartments * 3
                )
                assert await session.scalar(select(func.count()).select_from(Issue)) == 10
                assert await session.scalar(select(func.count()).select_from(UserApartment)) == 0
                assert await session.scalar(select(func.count()).select_from(HouseCamera)) == 15
                for house in await session.scalars(select(House)):
                    assert (
                        await session.scalar(
                            select(func.count())
                            .select_from(HouseCamera)
                            .where(HouseCamera.house_id == house.id)
                        )
                        == 3
                    )
                assert (
                    await session.get(HouseCamera, camera_id)
                ).note == "Existing configured camera"
                assert (await session.get(Meter, meter_id)).previous == Decimal("777.123")
                assert (await session.get(UtilityAccount, account_id)).number == "Existing account"
        finally:
            await db.close()

    asyncio.run(scenario())
