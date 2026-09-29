from app.database.models import CompanyHouse, House, HouseContact, ManagementCompany
from fastapi import HTTPException
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.contacts import ContactInput, ContactsInput, ContactsOutput
from smart_city_api.services.staff import house_scope


async def staff_house(session: AsyncSession, staff_id: int, house_id: int, *, lock=False):
    statement = select(House).where(House.id == house_id, House.id.in_(house_scope(staff_id)))
    if lock:
        statement = statement.with_for_update()
    if await session.scalar(statement) is None:
        raise HTTPException(404, "Дом не найден или недоступен")


async def read_contacts(session: AsyncSession, house_id: int) -> ContactsOutput:
    company_name = await session.scalar(
        select(ManagementCompany.name)
        .join(CompanyHouse, CompanyHouse.company_id == ManagementCompany.id)
        .where(CompanyHouse.house_id == house_id)
    )
    records = (
        await session.scalars(
            select(HouseContact)
            .where(HouseContact.house_id == house_id)
            .order_by(HouseContact.position)
        )
    ).all()
    return ContactsOutput(
        company_name=company_name or "Управляющая компания",
        items=[ContactInput.model_validate(row, from_attributes=True) for row in records],
    )


async def save_contacts(
    session: AsyncSession, staff_id: int, house_id: int, data: ContactsInput
) -> ContactsOutput:
    await staff_house(session, staff_id, house_id, lock=True)
    await session.execute(delete(HouseContact).where(HouseContact.house_id == house_id))
    session.add_all(
        HouseContact(house_id=house_id, position=position, **contact.model_dump())
        for position, contact in enumerate(data.items)
    )
    await session.commit()
    return await read_contacts(session, house_id)
