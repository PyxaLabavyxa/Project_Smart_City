from app.database.session import session_factory
from app.database.requests import create_issue
from app.services.report_analysis import generate_issue_data


async def submit_issue(
        max_user_id: int,
        house_id: int,
        description: str,
        report_model,
):
    description = description.strip()
    
    analysis = await generate_issue_data(
        description=description,
        model=report_model
    )

    async with session_factory.begin() as session:
        await create_issue(
            session=session,
            max_user_id=max_user_id,
            house_id=house_id,
            description=description,
            title=analysis.title,
            category=analysis.category,
            priority=analysis.priority
        )
