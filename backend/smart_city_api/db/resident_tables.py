import asyncio

from sqlalchemy import MetaData, Table
from sqlalchemy.ext.asyncio import AsyncSession


class ResidentTables:
    required = {
        "users": {"id", "name"},
        "houses": {"id", "address", "entrances_count", "floors_count", "apartments_per_floor"},
        "apartments": {"id", "house_id", "number", "entrance", "floor"},
        "user_apartments": {"user_id", "apartment_id"},
    }

    def __init__(self) -> None:
        self._tables: dict[str, Table] | None = None
        self._lock = asyncio.Lock()

    async def load(self, session: AsyncSession) -> dict[str, Table]:
        if self._tables is not None:
            return self._tables
        async with self._lock:
            if self._tables is None:
                metadata = MetaData()
                connection = await session.connection()
                await connection.run_sync(
                    lambda conn: metadata.reflect(conn, only=list(self.required), resolve_fks=False)
                )
                for name, columns in self.required.items():
                    if not columns.issubset(metadata.tables[name].c.keys()):
                        raise SchemaUnavailable("Resident schema is incompatible")
                self._tables = dict(metadata.tables)
        return self._tables


class SchemaUnavailable(Exception):
    pass
