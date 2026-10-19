from typing import Literal

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database.models import User

NotificationCategory = Literal[
    "personal_messages", "issue_messages", "issue_statuses", "announcements"
]


async def notification_enabled(
    session: AsyncSession, max_user_id: int, category: NotificationCategory
) -> bool:
    column = getattr(User, "notify_" + category)
    return await session.scalar(select(column).where(User.max_user_id == max_user_id)) is True
