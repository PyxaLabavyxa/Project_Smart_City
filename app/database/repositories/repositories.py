from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only, selectinload

from app.database.models import User, Issue, Apartment, UserApartment
from app.database.enums import IssueCategory, IssuePriority


class UserRepository:
    def __init__(self, session: AsyncSession) -> None:
        self.session = session


    async def get_user_object(self, max_user_id: int) -> User:
        stmt = (
            select(User)
            .where(User.max_user_id == max_user_id)
            .options(
                selectinload(User.apartment_links)
                .selectinload(UserApartment.apartment)
                .selectinload(Apartment.house),
                selectinload(User.issues)
            )
        )

        result = await self.session.execute(stmt)

        return result.scalar_one()

    async def user_exist(self, max_user_id: int) -> bool:
        stmt = (
            select(User)
            .where(User.max_user_id == max_user_id)
            .options(load_only(User.max_user_id))
        )

        result = await self.session.execute(stmt)

        return result.scalar_one_or_none() is not None

    async def create_user(self, max_user_id: int, name: str) -> None:
        user = User(max_user_id=max_user_id, name=name)
        self.session.add(user)


class IssueRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_issue(
            self,
            user_id: int,
            house_id: int,
            title: str,
            description: str,
            category: IssueCategory,
            priority: IssuePriority
    ) -> None:
        issue = Issue(
            user_id=user_id,
            house_id=house_id,
            title=title,
            description=description,
            category=category,
            priority=priority
        )

        self.session.add(issue)
