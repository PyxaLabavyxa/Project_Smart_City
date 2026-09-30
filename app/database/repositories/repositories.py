from sqlalchemy import select, and_, func, case
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import load_only, selectinload

from app.database.models import User, Issue, IssuePhoto, Apartment, UserApartment, IssueEvent
from app.database.enums import IssueCategory, IssuePriority, IssueStatus


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
            priority: IssuePriority,
            photo_paths: list[str] | None = None,
    ) -> Issue:
        issue = Issue(
            user_id=user_id,
            house_id=house_id,
            title=title,
            description=description,
            category=category,
            priority=priority,
            photos=[IssuePhoto(file_path=path) for path in (photo_paths or [])],
        )

        self.session.add(issue)
        await self.session.flush()
        self.session.add(IssueEvent(issue_id=issue.id, status=IssueStatus.NEW.value,
                                   created_at=issue.created_at))
        return issue

    async def get_last_issue(self, max_user_id: int, house_id: int) -> Issue | None:
        stmt = (
            select(Issue)
            .join(User, Issue.user_id == User.id)
            .where(
                and_(
                    User.max_user_id == max_user_id,
                    Issue.house_id == house_id,
                    Issue.rejected_at.is_(None),
                )
            )
            .order_by(
                Issue.created_at.desc(),
                Issue.id.desc()
            )
            .limit(1)
            .options(
                load_only(
                    Issue.description,
                    Issue.status,
                    Issue.title
                )
            )
        )

        result = await self.session.execute(stmt)

        return result.scalar_one_or_none()

    async def get_issue_statuses(self, max_user_id: int, house_id: int) -> dict[str, int | None]:
        stmt = (
            select(
                func.coalesce(
                    func.sum(
                        case((Issue.status == IssueStatus.NEW, 1), else_=0)
                    ),
                    0
                ).label("new"),
                func.coalesce(
                    func.sum(
                        case((Issue.status == IssueStatus.IN_PROGRESS, 1), else_=0)
                    ),
                    0
                ).label("in_progress"),
                func.coalesce(
                    func.sum(
                        case((Issue.status == IssueStatus.RESOLVED, 1), else_=0)
                    ),
                    0
                ).label("resolved"),
            )
            .join(User, Issue.user_id == User.id)
            .where(
                and_(
                    User.max_user_id == max_user_id,
                    Issue.house_id == house_id,
                    Issue.rejected_at.is_(None),
                )
            )
        )

        result = await self.session.execute(stmt)

        return result.mappings().one()
