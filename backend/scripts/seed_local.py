import asyncio

from app.database.models import Apartment, House, User, UserApartment
from sqlalchemy import select

from smart_city_api.core.config import Settings
from smart_city_api.core.local_login import LOCAL_USER_MAX_ID
from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory


async def main():
    settings = Settings()
    if not settings.local_login_enabled or not settings.database_url:
        raise SystemExit("Set LOCAL_LOGIN_ENABLED=true and DATABASE_URL first")
    database = Database(settings.database_url.get_secret_value())
    try:
        async with database.sessions() as session, session.begin():
            user = await session.scalar(select(User).where(User.max_user_id == LOCAL_USER_MAX_ID))
            if user is not None:
                print("Local resident already exists; data preserved")
                return
            user = User(max_user_id=LOCAL_USER_MAX_ID, name="Житель для локальной разработки")
            house = House(
                address="Тестовый дом, 1", entrances_count=2, floors_count=9, apartments_per_floor=4
            )
            session.add_all([user, house])
            await session.flush()
            for number in range(1, 73):
                apartment = Apartment(
                    house_id=house.id,
                    number=number,
                    entrance=(number - 1) // 36 + 1,
                    floor=((number - 1) % 36) // 4 + 1,
                )
                session.add(apartment)
                if number == 71:
                    await session.flush()
                    session.add(UserApartment(user_id=user.id, apartment_id=apartment.id))
    finally:
        await database.close()
    print("Local resident created; apartment 71, test house with 72 apartments")


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
