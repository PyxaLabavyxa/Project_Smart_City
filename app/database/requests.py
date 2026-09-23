from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.repositories import UserRepository, IssueRepository
from app.database.enums import IssueCategory, IssuePriority


async def create_user_if_exist(session: AsyncSession, max_user_id: int, name: str) -> None:
    users = UserRepository(session)

    if not await users.user_exist(max_user_id):
        await users.create_user(max_user_id, name)


async def create_issue(
        session: AsyncSession,
        max_user_id: int,
        house_id: int,
        description: str
) -> None:
    issues = IssueRepository(session)
    users = UserRepository(session)

    user = await users.get_user_object(max_user_id)
    # house_id = user.apartment_links[0].apartment.house_id

    await issues.create_issue(
        user_id=user.id,
        house_id=house_id,
        description=description,
        title="some title",
        category=IssueCategory.OTHER,
        priority=IssuePriority.HIGH
    )


async def get_user_houses(session: AsyncSession, max_user_id: int) -> list[tuple[int, str, int]]:
    users = UserRepository(session)
    user = await users.get_user_object(max_user_id)

    return [
        (ap.apartment.house_id, ap.apartment.house.address, ap.apartment.number)
        for ap in user.apartment_links
    ]
