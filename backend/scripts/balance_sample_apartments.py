"""Balance sample residents across entrances without replacing apartment identities."""

import asyncio

from app.database.models import Apartment, House, Issue, UserApartment
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
            house = await session.scalar(select(House).where(House.address == SAMPLE_HOUSE_ADDRESS))
            if house is None:
                return
            links = list(
                await session.execute(
                    select(UserApartment.user_id, Apartment)
                    .join(Apartment, Apartment.id == UserApartment.apartment_id)
                    .where(Apartment.house_id == house.id)
                    .order_by(UserApartment.user_id, Apartment.number)
                )
            )
            residents = {}
            for user_id, apartment in links:
                residents.setdefault(user_id, []).append(apartment)
            for apartments in residents.values():
                if len(apartments) != 2 or {a.entrance for a in apartments} == {1, 2}:
                    continue
                for desired in (1, 2):
                    if any(a.entrance == desired for a in apartments):
                        continue
                    moving = next(
                        (a for a in apartments if a.entrance not in (1, 2)), apartments[-1]
                    )
                    vacant = await session.scalar(
                        select(Apartment)
                        .where(
                            Apartment.house_id == house.id,
                            Apartment.entrance == desired,
                            ~Apartment.id.in_(select(UserApartment.apartment_id)),
                        )
                        .order_by(Apartment.number)
                        .limit(1)
                    )
                    if vacant is None:
                        raise RuntimeError(
                            "No vacant apartment in requested entrance; transaction rolled back"
                        )
                    old = (moving.number, moving.entrance, moving.floor)
                    new = (vacant.number, vacant.entrance, vacant.floor)
                    moving.number = -moving.id
                    await session.flush()
                    vacant.number, vacant.entrance, vacant.floor = old
                    await session.flush()
                    moving.number, moving.entrance, moving.floor = new
                    await session.flush()
                    for apartment in (moving, vacant):
                        for issue in await session.scalars(
                            select(Issue).where(Issue.apartment_id == apartment.id)
                        ):
                            issue.entrance, issue.floor = apartment.entrance, apartment.floor
            print(f"Balanced {len(residents)} residents; apartment IDs and related data preserved")
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
