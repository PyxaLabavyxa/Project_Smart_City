from smart_city_api.repositories.resident import ResidentRepository
from smart_city_api.schemas.resident import (
    ApartmentPage,
    HouseResponse,
    HouseStructure,
    ResidentResponse,
)


class ResidentNotFound(Exception):
    pass


class HouseNotFound(Exception):
    pass


class ResidentService:
    def __init__(self, repository: ResidentRepository, user_id: int) -> None:
        self.repository = repository
        self.user_id = user_id

    async def me(self) -> ResidentResponse:
        user = await self.repository.user(self.user_id)
        if user is None:
            raise ResidentNotFound
        return ResidentResponse(
            **user, apartments=await self.repository.own_apartments(self.user_id)
        )

    async def houses(self) -> list[HouseResponse]:
        return await self.repository.accessible_houses(self.user_id)

    async def house(self, house_id: int) -> HouseResponse:
        house = await self.repository.house(self.user_id, house_id)
        if house is None:
            raise HouseNotFound
        return house

    async def structure(self, house_id: int) -> HouseStructure:
        house = await self.house(house_id)
        return HouseStructure(
            house=house, floors=await self.repository.floor_counts(self.user_id, house_id)
        )

    async def apartments(
        self,
        house_id: int,
        *,
        entrance: int | None = None,
        floor: int | None = None,
        number: int | None = None,
        cursor: int = 0,
        limit: int = 20,
    ) -> ApartmentPage:
        if not 1 <= limit <= 100:
            raise ValueError("limit must be between 1 and 100")
        if cursor < 0:
            raise ValueError("cursor must be non-negative")
        await self.house(house_id)
        rows = await self.repository.list_apartments(
            self.user_id,
            house_id,
            entrance=entrance,
            floor=floor,
            number=number,
            cursor=cursor,
            limit=limit,
        )
        return ApartmentPage(
            items=rows[:limit], next_cursor=rows[limit - 1].id if len(rows) > limit else None
        )
