from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from smart_city_api.db.resident_tables import ResidentTables


class Database:
    def __init__(self, url: str) -> None:
        self.engine = create_async_engine(url, pool_pre_ping=True, hide_parameters=True)
        self.sessions = async_sessionmaker(self.engine, expire_on_commit=False)
        self.resident_tables = ResidentTables()

    async def close(self) -> None:
        await self.engine.dispose()
