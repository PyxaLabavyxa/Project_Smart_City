from datetime import datetime, timedelta
from uuid import NAMESPACE_URL, uuid5
from zoneinfo import ZoneInfo

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.camera_data import provision_cameras
from app.database.demo_services import provision_demo_utilities
from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import (
    House,
    Apartment,
    Issue,
    IssueEvent,
    User,
    UserApartment,
)

async def provision_sample_resident(session: AsyncSession, user_id: int) -> None:
    if session.bind.dialect.name == "postgresql":
        await session.execute(text("SELECT pg_advisory_xact_lock(71842026)"))
    await session.scalar(select(User).where(User.id == user_id).with_for_update())
    apartments = list(
        await session.scalars(
            select(Apartment)
            .join(UserApartment)
            .where(UserApartment.user_id == user_id)
            .order_by(Apartment.id)
        )
    )
    for house_id in {apartment.house_id for apartment in apartments}:
        await provision_cameras(session, await session.get(House, house_id))
    await provision_demo_utilities(session, apartments[:2])
    for index, apartment in enumerate(apartments[:2]):
        request_id = str(uuid5(NAMESPACE_URL, f"dompulse:sample:{user_id}:{index}"))
        if await session.scalar(
            select(Issue.id).where(Issue.user_id == user_id, Issue.request_id == request_id)
        ):
            continue
        status = IssueStatus.NEW if index == 0 else IssueStatus.IN_PROGRESS
        created = datetime.now(ZoneInfo("Europe/Moscow")) - timedelta(days=2 - index)
        issue = Issue(
            user_id=user_id,
            house_id=apartment.house_id,
            title="Не горит свет на этаже" if index == 0 else "Протекает кран",
            description=(
                "Лампа в коридоре не включается." if index == 0 else "В ванной подтекает кран."
            ),
            category=IssueCategory.ELECTRICITY if index == 0 else IssueCategory.WATER,
            priority=IssuePriority.MEDIUM,
            status=status,
            entrance=apartment.entrance,
            floor=apartment.floor,
            zone="corridor" if index == 0 else "apartment",
            apartment_id=None if index == 0 else apartment.id,
            request_id=request_id,
            created_at=created,
        )
        session.add(issue)
        await session.flush()
        session.add(IssueEvent(issue_id=issue.id, status=IssueStatus.NEW.value, created_at=created))
        if status == IssueStatus.IN_PROGRESS:
            session.add(
                IssueEvent(
                    issue_id=issue.id, status=status.value, created_at=created + timedelta(hours=2)
                )
            )
    await session.flush()
