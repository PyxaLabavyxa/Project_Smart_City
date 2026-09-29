from app.database.sample_data import provision_sample_resident
from sqlalchemy.ext.asyncio import AsyncSession


async def ensure_sample_data(session: AsyncSession, user_id: int) -> None:
    await provision_sample_resident(session, user_id)
    await session.commit()
