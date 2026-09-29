"""Explicit test-mode catalogue. Idempotent; never changes existing resident links."""

from sqlalchemy import select, text

from app.database.demo_issues import populate_house_examples
from app.database.demo_services import provision_demo_house_services
from app.database.models import Apartment, CompanyHouse, House, ManagementCompany


async def seed_registration_demo(session):
    if session.bind.dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(71842027)"))
    company = await session.scalar(
        select(ManagementCompany).where(ManagementCompany.name == "УК «ДомПульс»")
    )
    if company is not None:
        houses = list(
            await session.scalars(
                select(House).join(CompanyHouse).where(CompanyHouse.company_id == company.id)
            )
        )
        for house in houses:
            if house.address.startswith("ул. Солнечная, "):
                house.address = "г. Казань, " + house.address
        await provision_demo_house_services(session, houses)
        return
    company = ManagementCompany(name="УК «ДомПульс»")
    session.add(company)
    await session.flush()
    houses = []
    for index, floors in enumerate((9, 7, 5, 12, 10), 1):
        house = House(
            address=f"г. Казань, ул. Солнечная, {index}",
            entrances_count=2,
            floors_count=floors,
            apartments_per_floor=4,
        )
        session.add(house)
        await session.flush()
        houses.append(house)
        session.add(CompanyHouse(company_id=company.id, house_id=house.id))
        size = floors * 4
        for number in range(1, size * 2 + 1):
            session.add(
                Apartment(
                    house_id=house.id,
                    number=number,
                    entrance=(number - 1) // size + 1,
                    floor=((number - 1) % size) // 4 + 1,
                )
            )
    await populate_house_examples(session, houses)
    await provision_demo_house_services(session, houses)
    await session.flush()
