from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.database.repositories.repositories import UserRepository, IssueRepository
from app.database.enums import IssueCategory, IssuePriority
from app.database.models import User, Issue, Apartment, UserApartment



async def create_user_if_exist(session: AsyncSession, max_user_id: int, name: str) -> None:
    users = UserRepository(session)

    if not await users.user_exist(max_user_id):
        try:
            async with session.begin_nested():
                await users.create_user(max_user_id, name)
                await session.flush()
        except IntegrityError:
            if not await users.user_exist(max_user_id):
                raise



async def create_issue(
        session: AsyncSession,
        max_user_id: int,
        house_id: int,
        description: str,
        title: str,
        category: IssueCategory,
        priority: IssuePriority,
        photo_paths: list[str] | None = None,
) -> Issue:
    issues = IssueRepository(session)
    user = await get_issue_author(session, max_user_id, house_id)

    return await issues.create_issue(
        user_id=user.id,
        house_id=house_id,
        description=description,
        title=title,
        category=category,
        priority=priority,
        photo_paths=photo_paths,
    )


async def get_issue_author(session: AsyncSession, max_user_id: int, house_id: int) -> User:
    stmt = (
        select(User)
        .join(UserApartment, UserApartment.user_id == User.id)
        .join(Apartment, Apartment.id == UserApartment.apartment_id)
        .where(User.max_user_id == max_user_id, Apartment.house_id == house_id)
        .distinct()
    )
    user = (await session.execute(stmt)).scalar_one_or_none()
    if user is None:
        raise ValueError("Пользователь не связан с выбранным домом")
    return user


async def get_user_houses(session: AsyncSession, max_user_id: int) -> list[tuple[int, str, int]]:
    from app.database.models import House

    rows = await session.execute(
        select(House.id, House.address, Apartment.number)
        .join(Apartment, Apartment.house_id == House.id)
        .join(UserApartment, UserApartment.apartment_id == Apartment.id)
        .join(User, User.id == UserApartment.user_id)
        .where(User.max_user_id == max_user_id)
        .order_by(House.id, Apartment.number)
    )
    return [(house_id, address, number) for house_id, address, number in rows]
