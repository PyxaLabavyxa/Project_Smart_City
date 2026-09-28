from sqlalchemy.ext.asyncio import AsyncSession

from app.database.repositories.repositories import IssueRepository
from app.database.enums import IssueStatus
from chatbot.lexicon.lexicon import ISSUE_STATUS_LABELS, LEXICON


async def get_issue_information(session: AsyncSession, max_user_id: int, house_id: int) -> str:
    issues = IssueRepository(session)

    last_issue = await issues.get_last_issue(max_user_id, house_id)
    statuses = await issues.get_issue_statuses(max_user_id, house_id)

    new = statuses["new"]
    in_progress = statuses["in_progress"]
    resolved = statuses["resolved"]
    total = new + in_progress + resolved

    if last_issue is None:
        last_issue_text = LEXICON["no_issues"]
    else:
        status = ISSUE_STATUS_LABELS[last_issue.status]

        last_issue_text = LEXICON["last_issue"].format(
            title=last_issue.title,
            description=last_issue.description,
            status=status
        )

    all_statuses = "\n".join(
        f"{ISSUE_STATUS_LABELS[stat]}: {count}"
        for stat, count in zip(
            map(lambda x: x.value, IssueStatus), (new, in_progress, resolved)
        )
    )

    return LEXICON["issue_statistics"].format(
        total=total,
        all_statuses=all_statuses,
        last_issue=last_issue_text
    )
