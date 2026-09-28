from app.database.models import Apartment, House, UserApartment
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession


def own_apartment_ids(user_id: int):
    return select(UserApartment.apartment_id).where(UserApartment.user_id == user_id)


async def require_house(session: AsyncSession, user_id: int, house_id: int) -> House:
    allowed = select(Apartment.house_id).where(Apartment.id.in_(own_apartment_ids(user_id)))
    house = await session.scalar(select(House).where(House.id == house_id, House.id.in_(allowed)))
    if house is None:
        raise HTTPException(404, "Дом не найден")
    return house


async def require_apartment(session: AsyncSession, user_id: int, apartment_id: int) -> Apartment:
    apartment = await session.scalar(
        select(Apartment).where(
            Apartment.id == apartment_id,
            Apartment.id.in_(own_apartment_ids(user_id)),
        )
    )
    if apartment is None:
        raise HTTPException(404, "Квартира не найдена")
    return apartment
