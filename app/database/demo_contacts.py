from random import Random

from sqlalchemy import select

from app.database.models import HouseContact


async def seed_demo_contacts(session, houses):
    """Fill missing demo-house contacts without overwriting staff edits."""
    for house in houses:
        if await session.scalar(
            select(HouseContact.id).where(HouseContact.house_id == house.id).limit(1)
        ):
            continue
        random = Random(house.address)
        for position, label in enumerate(("Диспетчерская", "Приёмная УК")):
            suffix = random.randrange(1000000, 10000000)
            digits = str(suffix)
            value = f"+7 (000) {digits[:3]}-{digits[3:5]}-{digits[5:]}"
            session.add(
                HouseContact(
                    house_id=house.id,
                    position=position,
                    label=label,
                    kind="phone",
                    value=value,
                    note="Тестовый номер: не предназначен для звонков",
                )
            )
    await session.flush()
