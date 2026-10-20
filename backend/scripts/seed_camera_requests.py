"""Explicit, idempotent local demo data. Never runs on application startup."""

import asyncio
from datetime import UTC, datetime

from app.database.models import (
    Apartment,
    CompanyHouse,
    HouseCamera,
    ManagementCompany,
    RegistrationRequest,
    User,
    UserApartment,
)
from sqlalchemy import select

from smart_city_api.core.config import Settings
from smart_city_api.core.local_login import LOCAL_USER_MAX_ID
from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory


async def main():
    settings = Settings()
    if not settings.local_login_enabled or not settings.database_url:
        raise SystemExit("This seed requires LOCAL_LOGIN_ENABLED=true and DATABASE_URL")
    database = Database(settings.database_url.get_secret_value())
    try:
        async with database.sessions.begin() as session:
            owner = await session.scalar(select(User).where(User.max_user_id == LOCAL_USER_MAX_ID))
            if not owner:
                raise SystemExit("Run seed_local first")
            apartment = await session.scalar(
                select(Apartment)
                .join(UserApartment, UserApartment.apartment_id == Apartment.id)
                .where(UserApartment.user_id == owner.id)
                .order_by(Apartment.id)
            )
            if not apartment:
                raise SystemExit("Local resident has no apartment")
            house_id = apartment.house_id
            examples = [
                ("Вход в первый подъезд", "pending", 1, 1, "entrance", "entrance-1"),
                (
                    "Площадка у лифта",
                    "pending",
                    apartment.entrance,
                    apartment.floor,
                    "elevator",
                    "entrance-2",
                ),
                ("Вид на двор", "pending", None, None, "courtyard", "yard"),
                ("Вход со двора", "approved", 1, 1, "entrance", "entrance-1"),
                ("Парковка у дома", "rejected", None, None, "parking", "yard"),
            ]
            for name, status, entrance, floor, zone, asset in examples:
                name = "Тест · " + name
                if await session.scalar(
                    select(HouseCamera.id).where(
                        HouseCamera.house_id == house_id, HouseCamera.name == name
                    )
                ):
                    continue
                session.add(
                    HouseCamera(
                        house_id=house_id,
                        owner_id=owner.id,
                        name=name,
                        note="Тестовая заявка для проверки кабинета УК",
                        status="online",
                        visibility="public",
                        moderation_status=status,
                        moderation_reason="Тест: уточните, куда направлена камера"
                        if status == "rejected"
                        else None,
                        preview_url=f"/images/cameras/{asset}-1.png",
                        captured_at=datetime.now(UTC),
                        entrance=entrance,
                        floor=floor,
                        zone=zone,
                    )
                )
            membership = await session.get(CompanyHouse, house_id)
            if membership is None:
                company = await session.scalar(
                    select(ManagementCompany).order_by(ManagementCompany.id)
                )
                if company is None:
                    company = ManagementCompany(name="Тестовая управляющая компания")
                    session.add(company)
                    await session.flush()
                membership = CompanyHouse(house_id=house_id, company_id=company.id)
                session.add(membership)
            apartments = list(
                await session.scalars(
                    select(Apartment)
                    .where(Apartment.house_id == house_id)
                    .order_by(Apartment.number)
                    .limit(4)
                )
            )
            names = ["Анна Смирнова", "Михаил Козлов", "Елена Орлова", "Дмитрий Волков"]
            for index, (flat, name) in enumerate(zip(apartments, names, strict=False)):
                max_id = -8_200_000_100 - index
                user = await session.scalar(select(User).where(User.max_user_id == max_id))
                if user:
                    continue
                user = User(max_user_id=max_id, name="Тест · " + name, bot_dialog_started=False)
                session.add(user)
                await session.flush()
                session.add(
                    RegistrationRequest(
                        user_id=user.id,
                        company_id=membership.company_id,
                        apartment_id=flat.id,
                        full_name=user.name,
                        source="mini_app",
                        status="pending",
                        auto_approved=False,
                    )
                )
        print("Local demo camera and registration requests are ready")
    finally:
        await database.close()


if __name__ == "__main__":
    asyncio.run(main(), loop_factory=loop_factory)
