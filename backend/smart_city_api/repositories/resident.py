from sqlalchemy import Table, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.resident import ApartmentResponse, FloorResponse, HouseResponse


class ResidentRepository:
    def __init__(self, session: AsyncSession, tables: dict[str, Table]) -> None:
        self.session = session
        self.users = tables["users"]
        self.houses = tables["houses"]
        self.apartments = tables["apartments"]
        self.links = tables["user_apartments"]

    def membership(self, user_id: int):
        a, link = self.apartments, self.links
        return (
            select(a.c.house_id)
            .join(link, link.c.apartment_id == a.c.id)
            .where(link.c.user_id == user_id)
        )

    async def user(self, user_id: int):
        query = select(self.users.c.id, self.users.c.name).where(self.users.c.id == user_id)
        return (await self.session.execute(query)).mappings().one_or_none()

    async def own_apartments(self, user_id: int) -> list[ApartmentResponse]:
        a, link = self.apartments, self.links
        query = (
            select(a)
            .join(link, link.c.apartment_id == a.c.id)
            .where(link.c.user_id == user_id)
            .order_by(a.c.house_id, a.c.number, a.c.id)
        )
        return [
            ApartmentResponse.model_validate(row)
            for row in (await self.session.execute(query)).mappings()
        ]

    async def accessible_houses(self, user_id: int) -> list[HouseResponse]:
        h = self.houses
        query = select(h).where(h.c.id.in_(self.membership(user_id))).order_by(h.c.id)
        return [
            HouseResponse.model_validate(row)
            for row in (await self.session.execute(query)).mappings()
        ]

    async def house(self, user_id: int, house_id: int) -> HouseResponse | None:
        h = self.houses
        query = select(h).where(h.c.id == house_id, h.c.id.in_(self.membership(user_id)))
        row = (await self.session.execute(query)).mappings().one_or_none()
        return HouseResponse.model_validate(row) if row else None

    async def floor_counts(self, user_id: int, house_id: int) -> list[FloorResponse]:
        a = self.apartments
        query = (
            select(a.c.entrance, a.c.floor, func.count().label("apartments_count"))
            .where(a.c.house_id == house_id, a.c.house_id.in_(self.membership(user_id)))
            .group_by(a.c.entrance, a.c.floor)
            .order_by(a.c.entrance, a.c.floor)
        )
        return [
            FloorResponse.model_validate(row)
            for row in (await self.session.execute(query)).mappings()
        ]

    async def list_apartments(
        self,
        user_id: int,
        house_id: int,
        *,
        entrance: int | None,
        floor: int | None,
        number: int | None,
        cursor: int,
        limit: int,
    ) -> list[ApartmentResponse]:
        a = self.apartments
        query = select(a).where(
            a.c.house_id == house_id, a.c.house_id.in_(self.membership(user_id)), a.c.id > cursor
        )
        for column, value in ((a.c.entrance, entrance), (a.c.floor, floor), (a.c.number, number)):
            if value is not None:
                query = query.where(column == value)
        query = query.order_by(a.c.id).limit(limit + 1)
        return [
            ApartmentResponse.model_validate(row)
            for row in (await self.session.execute(query)).mappings()
        ]
