from collections.abc import AsyncIterator

from sqlalchemy.ext.asyncio import AsyncSession

from app.database.session import session_factory


async def get_session() -> AsyncIterator[AsyncSession]:
    """Сессия на запрос. Транзакцию записи открывает вызывающий код."""
    async with session_factory() as session:
        yield session
