from pydantic import BaseModel


class ApartmentResponse(BaseModel):
    id: int
    house_id: int
    number: int
    entrance: int
    floor: int


class ResidentResponse(BaseModel):
    id: int
    name: str
    apartments: list[ApartmentResponse]


class HouseResponse(BaseModel):
    id: int
    address: str
    entrances_count: int
    floors_count: int
    apartments_per_floor: int


class ApartmentPage(BaseModel):
    items: list[ApartmentResponse]
    next_cursor: int | None


class FloorResponse(BaseModel):
    entrance: int
    floor: int
    apartments_count: int


class HouseStructure(BaseModel):
    house: HouseResponse
    floors: list[FloorResponse]
