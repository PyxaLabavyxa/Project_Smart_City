import re

from app.database.models import CompanyHouse, House, HouseContact, ManagementCompany
from fastapi import HTTPException
from pydantic import ValidationError
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.contacts import (
    BulkContactsInput,
    BulkContactsOutput,
    BulkContactsPatchInput,
    ContactInput,
    ContactsInput,
    ContactsOutput,
)
from smart_city_api.services.staff import house_scope

# Fixed fields in the staff contact form; other contacts keep their own identities.
CONTACT_FIELDS = {
    "dispatcher": ("phone", "Диспетчерская", r"диспетчер"),
    "email": ("email", "Электронная почта", None),
    "website": ("website", "Сайт УК", None),
    "office": ("address", "Адрес офиса", None),
    "hours": ("schedule", "График работы", r"график|работ"),
    "reception": ("schedule", "Приём жителей", r"при[её]м"),
    "emergency": ("phone", "Аварийная служба", r"авари|экстрен"),
}


def contact_field_indexes(items):
    fields, remaining = {}, list(range(len(items)))
    for field, (kind, _, pattern) in sorted(
        CONTACT_FIELDS.items(), key=lambda entry: bool(entry[1][2]), reverse=True
    ):
        index = next(
            (
                index
                for index in remaining
                if items[index].kind == kind
                and (not pattern or re.search(pattern, items[index].label, re.I))
            ),
            None,
        )
        if index is not None:
            fields[field] = index
            remaining.remove(index)
    if "dispatcher" not in fields:
        index = next((index for index in remaining if items[index].kind == "phone"), None)
        if index is not None:
            fields["dispatcher"] = index
            remaining.remove(index)
    return fields


def patch_contact_items(items, data: BulkContactsPatchInput):
    fields = contact_field_indexes(items)
    replacements, added = {}, []
    for field, change in data.changes.items():
        kind, label, _ = CONTACT_FIELDS[field]
        index = fields.get(field)
        previous = items[index] if index is not None else None
        if "value" in change.model_fields_set and not change.value:
            if index is not None:
                replacements[index] = None
            continue
        if previous is None and "value" not in change.model_fields_set:
            continue
        try:
            contact = ContactInput(
                label=previous.label if previous else label,
                kind=kind,
                value=change.value if "value" in change.model_fields_set else previous.value,
                note=change.note
                if "note" in change.model_fields_set
                else previous.note
                if previous
                else "",
            )
        except ValidationError as error:
            message = error.errors()[0]["msg"].removeprefix("Value error, ")
            raise HTTPException(422, f"{label}: {message}") from error
        if index is None:
            added.append(contact)
        else:
            replacements[index] = contact
    for change in data.extra_changes:
        matches = [
            index
            for index in range(len(items))
            if items[index].kind == change.kind and items[index].label == change.label
        ]
        if len(matches) > 1:
            raise HTTPException(
                409,
                "Есть дополнительные контакты с одинаковым названием. "
                "Измените их отдельно для этого дома.",
            )
        if matches:
            if matches[0] in replacements and replacements[matches[0]] != change.contact:
                raise HTTPException(
                    409,
                    "В одном из домов основной и дополнительный контакты совпадают. "
                    "Измените их отдельно для этого дома.",
                )
            replacements[matches[0]] = change.contact
        elif change.contact:
            added.append(change.contact)
    updated = [
        contact
        for index, item in enumerate(items)
        if (contact := replacements.get(index, item)) is not None
    ] + added
    if len(updated) > 12:
        raise HTTPException(422, "В одном из выбранных домов получится больше 12 контактов")
    return updated


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
    await replace_contacts(session, staff_id, [house_id], data.items)
    return await read_contacts(session, house_id)


async def replace_contacts(
    session: AsyncSession, staff_id: int, house_ids: list[int], items: list[ContactInput]
) -> None:
    houses = await lock_contact_houses(session, staff_id, house_ids)
    await session.execute(delete(HouseContact).where(HouseContact.house_id.in_(house_ids)))
    session.add_all(
        HouseContact(house_id=house_id, position=position, **contact.model_dump())
        for house_id in houses
        for position, contact in enumerate(items)
    )
    await session.commit()


async def lock_contact_houses(session, staff_id, house_ids):
    # All contact writers use the same ordered house locks and authorization.
    houses = (
        await session.scalars(
            select(House.id)
            .where(House.id.in_(house_ids), House.id.in_(house_scope(staff_id)))
            .order_by(House.id)
            .with_for_update()
        )
    ).all()
    if len(houses) != len(house_ids):
        raise HTTPException(404, "Один из домов не найден или недоступен")
    return houses


async def save_contacts_bulk(
    session: AsyncSession, staff_id: int, data: BulkContactsInput
) -> BulkContactsOutput:
    await replace_contacts(session, staff_id, data.house_ids, data.items)
    return BulkContactsOutput(house_ids=data.house_ids, updated_count=len(data.house_ids))


async def patch_contacts_bulk(
    session: AsyncSession, staff_id: int, data: BulkContactsPatchInput
) -> BulkContactsOutput:
    houses = await lock_contact_houses(session, staff_id, data.house_ids)
    records = (
        await session.scalars(
            select(HouseContact)
            .where(HouseContact.house_id.in_(houses))
            .order_by(HouseContact.house_id, HouseContact.position)
        )
    ).all()
    by_house = {house_id: [] for house_id in houses}
    for row in records:
        by_house[row.house_id].append(ContactInput.model_validate(row, from_attributes=True))
    # Validate every resulting set before writing; failures leave every house untouched.
    updated = {house_id: patch_contact_items(items, data) for house_id, items in by_house.items()}
    await session.execute(delete(HouseContact).where(HouseContact.house_id.in_(houses)))
    session.add_all(
        HouseContact(house_id=house_id, position=position, **contact.model_dump())
        for house_id, items in updated.items()
        for position, contact in enumerate(items)
    )
    await session.commit()
    return BulkContactsOutput(house_ids=data.house_ids, updated_count=len(houses))
