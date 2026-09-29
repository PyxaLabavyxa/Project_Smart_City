import argparse
import asyncio

from app.database.models import CompanyHouse, ManagementCompany, StaffHouse, StaffUser
from app.database.registration_demo import seed_registration_demo
from sqlalchemy import select

from smart_city_api.core.config import Settings
from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory


async def run(logins):
    settings = Settings()
    if not settings.database_url:
        raise ValueError("DATABASE_URL is required")
    db = Database(settings.database_url.get_secret_value())
    try:
        async with db.sessions.begin() as session:
            await seed_registration_demo(session)
            company_id = await session.scalar(
                select(ManagementCompany.id).where(ManagementCompany.name == "УК «ДомПульс»")
            )
            houses = list(
                await session.scalars(
                    select(CompanyHouse.house_id).where(CompanyHouse.company_id == company_id)
                )
            )
            for login in logins:
                staff = await session.scalar(
                    select(StaffUser).where(StaffUser.login == login, StaffUser.active.is_(True))
                )
                if staff is None:
                    raise ValueError(f"Active employee not found: {login}")
                existing = set(
                    await session.scalars(
                        select(StaffHouse.house_id).where(StaffHouse.staff_id == staff.id)
                    )
                )
                session.add_all(
                    StaffHouse(staff_id=staff.id, house_id=h) for h in houses if h not in existing
                )
            print(
                f"Demo houses: {houses}; staff: {', '.join(logins) or 'no assignments requested'}"
            )
    finally:
        await db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--staff-login", action="append", default=[])
    args = parser.parse_args()
    asyncio.run(run(args.staff_login), loop_factory=loop_factory)
