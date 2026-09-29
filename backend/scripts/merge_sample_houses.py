import asyncio
import math

from app.database.models import Apartment, House, HouseCamera, HouseWork, Issue
from app.database.sample_data import SAMPLE_HOUSE_ADDRESS
from sqlalchemy import select, text

from smart_city_api.core.config import Settings
from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory


async def main():
    settings = Settings()
    if not settings.sample_data_enabled or not settings.database_url:
        raise SystemExit("SAMPLE_DATA_ENABLED and DATABASE_URL required")
    database = Database(settings.database_url.get_secret_value())
    try:
        async with database.sessions() as session, session.begin():
            await session.execute(text("SELECT pg_advisory_xact_lock(71842026)"))
            houses = list(
                await session.scalars(
                    select(House)
                    .where(
                        House.address.startswith("Тестовый дом")
                        | (House.address == SAMPLE_HOUSE_ADDRESS)
                    )
                    .order_by(House.id)
                )
            )
            if not houses:
                print("No generated houses to merge")
                return
            target = next((h for h in houses if h.address == SAMPLE_HOUSE_ADDRESS), houses[0])
            target.address = SAMPLE_HOUSE_ADDRESS
            target.floors_count = 15
            target.apartments_per_floor = 4
            target_rows = list(
                await session.scalars(
                    select(Apartment)
                    .where(Apartment.house_id == target.id)
                    .order_by(Apartment.number)
                )
            )
            last = max((a.number for a in target_rows), default=0)
            for source in houses:
                if source.id == target.id:
                    continue
                rows = list(
                    await session.scalars(
                        select(Apartment)
                        .where(Apartment.house_id == source.id)
                        .order_by(Apartment.number)
                    )
                )
                for apartment in rows:
                    last += 1
                    apartment.house_id = target.id
                    apartment.number = last
                    target_rows.append(apartment)
                for model in (Issue, HouseCamera, HouseWork):
                    for row in await session.scalars(
                        select(model).where(model.house_id == source.id)
                    ):
                        row.house_id = target.id
            entrances = max(2, math.ceil(last / 60))
            target.entrances_count = entrances
            for number in range(last + 1, entrances * 60 + 1):
                apartment = Apartment(house_id=target.id, number=number, entrance=1, floor=1)
                session.add(apartment)
                target_rows.append(apartment)
            for apartment in target_rows:
                apartment.entrance = (apartment.number - 1) // 60 + 1
                apartment.floor = ((apartment.number - 1) % 60) // 4 + 1
            await session.flush()
            lookup = {a.id: a for a in target_rows}
            for issue in await session.scalars(select(Issue).where(Issue.house_id == target.id)):
                if issue.apartment_id in lookup:
                    apartment = lookup[issue.apartment_id]
                    issue.entrance, issue.floor = apartment.entrance, apartment.floor
            print(f"Shared house: {entrances} entrances, 15 floors, {len(target_rows)} apartments")
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
