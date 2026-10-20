from app.database.models import Apartment, House
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.app import Location
from smart_city_api.services.access import own_apartment_ids

OUTDOOR_ZONES = {"house", "courtyard", "parking"}


async def validate_location(session: AsyncSession, user_id: int, house: House, place: Location):
    if place.zone in OUTDOOR_ZONES:
        return
    if place.entrance > house.entrances_count or place.floor > house.floors_count:
        raise HTTPException(422, "Такого этажа или подъезда нет в доме")
    if place.zone == "entrance" and place.floor != 1:
        raise HTTPException(422, "Входная группа находится на первом этаже")
    if place.apartment_id:
        apartment = await session.scalar(
            select(Apartment.id).where(
                Apartment.id == place.apartment_id,
                Apartment.house_id == house.id,
                Apartment.entrance == place.entrance,
                Apartment.floor == place.floor,
                Apartment.id.in_(own_apartment_ids(user_id)),
            )
        )
        if apartment is None:
            raise HTTPException(422, "Выберите свою квартиру или общую зону")
