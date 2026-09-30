from sqlalchemy import exists, select
from sqlalchemy.exc import IntegrityError

from app.database.models import Issue, IssueMessage, StaffNotification, User


async def reply_issue(session, max_user_id: int, issue_id: int) -> Issue | None:
    return await session.scalar(
        select(Issue)
        .join(User, User.id == Issue.user_id)
        .where(
            Issue.id == issue_id,
            Issue.rejected_at.is_(None),
            User.max_user_id == max_user_id,
            exists(select(StaffNotification.id).where(StaffNotification.issue_id == Issue.id)),
        )
    )


async def save_reply(sessions, max_user_id: int, issue_id: int, text: str, mid: str) -> None:
    text = text.strip()
    if not 1 <= len(text) <= 1500:
        raise ValueError("Отправьте текст от 1 до 1500 символов")
    request_id = f"max:{max_user_id}:{mid}"
    if len(request_id) > 200:
        raise ValueError("Не удалось распознать сообщение. Отправьте его заново")
    async with sessions() as session:
        issue = await reply_issue(session, max_user_id, issue_id)
        if issue is None:
            raise ValueError("Обращение недоступно. Откройте уведомление по своей заявке")
        prior = select(IssueMessage.id).where(
            IssueMessage.issue_id == issue_id, IssueMessage.request_id == request_id
        )
        if await session.scalar(prior):
            return
        session.add(
            IssueMessage(issue_id=issue_id, user_id=issue.user_id, text=text, request_id=request_id)
        )
        try:
            await session.commit()
        except IntegrityError:
            await session.rollback()
            if not await session.scalar(prior):
                raise
