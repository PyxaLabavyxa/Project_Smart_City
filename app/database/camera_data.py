"""Provision still-image cameras without replacing configured camera feeds."""

from datetime import UTC, datetime

from sqlalchemy import select, text

from app.database.models import House, HouseCamera


async def provision_cameras(session, house):
    if session.bind.dialect.name == "postgresql":
        await session.execute(
            text("SELECT pg_advisory_xact_lock(:key)"), {"key": 82000000 + house.id}
        )
    existing = set(
        await session.scalars(
            select(HouseCamera.name).where(HouseCamera.house_id == house.id)
        )
    )
    zones = [
        (
            f"Подъезд {entrance}",
            f"Входная зона · подъезд {entrance}",
            f"entrance-{(entrance - 1) % 2 + 1}",
        )
        for entrance in range(1, house.entrances_count + 1)
    ] + [("Двор", "Двор и детская площадка", "yard")]
    for name, note, asset in zones:
        if name not in existing:
            session.add(
                HouseCamera(
                    house_id=house.id,
                    name=name,
                    note=note,
                    status="online",
                    preview_url=f"/images/cameras/{asset}-1.png",
                    captured_at=datetime.now(UTC),
                )
            )
    await session.flush()


async def provision_all_cameras(session):
    for house in await session.scalars(select(House)):
        await provision_cameras(session, house)
