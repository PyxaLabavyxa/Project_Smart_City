from datetime import UTC

from app.database.models import Issue, IssueMessage, StaffUser, User
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.issue_chat import (
    IssueMessageInput,
    IssueMessageOutput,
    IssueMessagePage,
)
from smart_city_api.services.access import require_house


async def own_issue(
    session: AsyncSession, user_id: int, issue_id: int, *, lock: bool = False
) -> Issue:
    statement = select(Issue).where(
        Issue.id == issue_id, Issue.user_id == user_id, Issue.rejected_at.is_(None)
    )
    issue = await session.scalar(statement.with_for_update() if lock else statement)
    if issue is None:
        raise HTTPException(404, "Обращение не найдено")
    await require_house(session, user_id, issue.house_id)
    return issue


def message_output(message: IssueMessage, author: str) -> IssueMessageOutput:
    return IssueMessageOutput(
        id=message.id,
        direction="staff" if message.staff_id is not None else "resident",
        author=author,
        text=message.text,
        created_at=(
            message.created_at
            if message.created_at.tzinfo
            else message.created_at.replace(tzinfo=UTC)
        ),
    )


async def read_messages(
    session: AsyncSession, user_id: int, issue_id: int, cursor: int, limit: int
) -> IssueMessagePage:
    await own_issue(session, user_id, issue_id)
    rows = (
        await session.execute(
            select(IssueMessage, StaffUser.name, User.name)
            .outerjoin(StaffUser, StaffUser.id == IssueMessage.staff_id)
            .outerjoin(User, User.id == IssueMessage.user_id)
            .where(IssueMessage.issue_id == issue_id, IssueMessage.id > cursor)
            .order_by(IssueMessage.id)
            .limit(limit + 1)
        )
    ).all()
    return IssueMessagePage(
        items=[
            message_output(message, staff_name or resident_name or "Сотрудник УК")
            for message, staff_name, resident_name in rows[:limit]
        ],
        next_cursor=rows[limit - 1][0].id if len(rows) > limit else None,
    )


async def send_message(
    session: AsyncSession, user: User, issue_id: int, data: IssueMessageInput
) -> IssueMessageOutput:
    user_id, author = user.id, user.name
    await own_issue(session, user_id, issue_id, lock=True)
    request_key = f"resident:{user_id}:{data.request_id}"
    statement = select(IssueMessage).where(
        IssueMessage.issue_id == issue_id, IssueMessage.request_id == request_key
    )
    previous = await session.scalar(statement)
    if previous is not None:
        if previous.text != data.text:
            raise HTTPException(409, "Этот запрос уже использован для другого сообщения")
        return message_output(previous, author)
    message = IssueMessage(
        issue_id=issue_id, user_id=user_id, text=data.text, request_id=request_key
    )
    session.add(message)
    try:
        await session.commit()
    except IntegrityError:
        await session.rollback()
        await own_issue(session, user_id, issue_id)
        previous = await session.scalar(statement)
        if previous is None:
            raise
        if previous.text != data.text:
            raise HTTPException(409, "Этот запрос уже использован для другого сообщения") from None
        return message_output(previous, author)
    await session.refresh(message)
    return message_output(message, author)
