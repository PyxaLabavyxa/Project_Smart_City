from app.database.session import session_factory
from app.database.requests import create_issue, get_issue_author
from app.services.report_analysis import generate_issue_data
from app.storage.photos import LocalPhotoStorage


async def submit_issue(
        max_user_id: int,
        house_id: int,
        description: str,
        report_model,
        photo_storage: LocalPhotoStorage,
        photo_urls: list[str] | None = None
) -> int:
    description = (description or "").strip()
    if not description or len(description) > 6000:
        raise ValueError("Нужно текстовое описание длиной от 1 до 6000 символов")

    async with session_factory() as session:
        await get_issue_author(session, max_user_id, house_id)
    
    analysis = await generate_issue_data(
        description=description,
        model=report_model
    )

    paths = await photo_storage.save_many(photo_urls or [])
    try:
        async with session_factory.begin() as session:
            issue = await create_issue(
                session=session,
                max_user_id=max_user_id,
                house_id=house_id,
                description=description,
                title=analysis.title,
                category=analysis.category,
                priority=analysis.priority,
                photo_paths=paths
            )
            issue_id = issue.id
    except Exception:
        await photo_storage.delete_many(paths)
        raise
    return issue_id
