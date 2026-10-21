from app.database.models import Apartment, RegistrationRequest, User, UserApartment
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.services.staff import house_scope


async def delete_registration(session: AsyncSession, staff_id: int, application_id: int):
    application = await session.scalar(
        select(RegistrationRequest)
        .join(Apartment, Apartment.id == RegistrationRequest.apartment_id)
        .where(
            RegistrationRequest.id == application_id,
            Apartment.house_id.in_(house_scope(staff_id)),
        )
        .with_for_update(of=RegistrationRequest)
    )
    if application is None:
        raise HTTPException(404, "Заявка не найдена или недоступна")

    # Registration and approval also lock the resident before changing apartment links.
    await session.scalar(select(User.id).where(User.id == application.user_id).with_for_update())
    if application.status == "approved":
        await session.execute(
            delete(UserApartment).where(
                UserApartment.user_id == application.user_id,
                UserApartment.apartment_id == application.apartment_id,
            )
        )
    await session.delete(application)
    await session.commit()
