import asyncio
import os

from app.database.camera_data import provision_all_cameras
from app.database.models import Invoice, Issue, Meter, UtilityAccount
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine


async def main():
    engine = create_async_engine(os.environ["DATABASE_URL"])
    try:
        async with async_sessionmaker(engine)() as session:
            await provision_all_cameras(session)
            for model, field, old, new in (
                (UtilityAccount, "number", "TEST-", "LS-"),
                (Meter, "serial", "TEST-", "LS-"),
                (Invoice, "number", "ТЕСТ-", "КВ-"),
            ):
                for row in await session.scalars(
                    select(model).where(getattr(model, field).startswith(old))
                ):
                    setattr(
                        row,
                        field,
                        getattr(row, field).replace(old, new, 1).removesuffix(" · не к оплате"),
                    )
            prefix = "Тестовое обращение для проверки приложения. "
            descriptions = [
                prefix + "Лампа в коридоре не включается.",
                prefix + "В ванной подтекает кран.",
            ]
            for row in await session.scalars(
                select(Issue).where(Issue.description.in_(descriptions))
            ):
                row.description = row.description.removeprefix(prefix)
            await session.commit()
    finally:
        await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
