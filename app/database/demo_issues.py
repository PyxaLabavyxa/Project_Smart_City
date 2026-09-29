"""Two explicit demo incidents per house; destructive reset is only an admin operation."""

from sqlalchemy import delete, select

from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import (
    House,
    Issue,
    IssueEvent,
    IssueMessage,
    IssuePhoto,
    StaffNotification,
    User,
)

EXAMPLES = [
    (
        "Не горит свет у лифта",
        "На первом этаже перегорела лампа рядом с лифтом.",
        IssueCategory.ELECTRICITY,
        "elevator",
    ),
    (
        "Подтекает труба в подъезде",
        "На первом этаже у стояка появилась небольшая лужа.",
        IssueCategory.WATER,
        "entrance",
    ),
    (
        "Повреждена скамейка во дворе",
        "У скамейки возле входа сломана одна доска.",
        IssueCategory.YARD,
        "courtyard",
    ),
    (
        "Лифт останавливается с рывком",
        "При остановке на первом этаже слышен стук.",
        IssueCategory.ELEVATOR,
        "elevator",
    ),
    (
        "Переполнены контейнеры",
        "Нужно вывезти мусор с площадки у дома.",
        IssueCategory.GARBAGE,
        "courtyard",
    ),
    (
        "Не закрывается входная дверь",
        "Доводчик не доводит дверь до замка.",
        IssueCategory.ENTRANCE,
        "entrance",
    ),
    (
        "Мигает лампа на лестнице",
        "На втором этаже лампа периодически гаснет.",
        IssueCategory.ELECTRICITY,
        "stairs",
    ),
    (
        "Мусор на дорожке во дворе",
        "После ветра на дорожке лежат упаковки и ветки.",
        IssueCategory.YARD,
        "courtyard",
    ),
    (
        "Холодная батарея на площадке",
        "Радиатор на втором этаже заметно холоднее остальных.",
        IssueCategory.HEATING,
        "corridor",
    ),
    (
        "Расшатаны перила",
        "На втором этаже ослабло крепление поручня.",
        IssueCategory.ENTRANCE,
        "stairs",
    ),
    (
        "Скрипит дверь подъезда",
        "Петли входной двери требуют смазки.",
        IssueCategory.ENTRANCE,
        "entrance",
    ),
    (
        "Не горит фонарь во дворе",
        "Фонарь у дорожки не включается вечером.",
        IssueCategory.ELECTRICITY,
        "courtyard",
    ),
]


async def populate_house_examples(session, houses):
    reporter = await session.scalar(select(User).where(User.max_user_id == -71842027))
    if reporter is None:
        reporter = User(max_user_id=-71842027, name="Демонстрационные обращения")
        session.add(reporter)
        await session.flush()
    for index, house in enumerate(houses):
        for offset in range(2):
            title, description, category, zone = EXAMPLES[(index * 2 + offset) % len(EXAMPLES)]
            issue = Issue(
                user_id=reporter.id,
                house_id=house.id,
                title=title,
                description="Тестовый инцидент. " + description,
                category=category,
                priority=IssuePriority.MEDIUM if offset == 0 else IssuePriority.LOW,
                status=IssueStatus.NEW if offset == 0 else IssueStatus.IN_PROGRESS,
                zone=zone,
                entrance=1,
                floor=min(2, house.floors_count) if zone in ("stairs", "corridor") else 1,
            )
            session.add(issue)
            await session.flush()
            session.add(IssueEvent(issue_id=issue.id, status=IssueStatus.NEW.value))
            if issue.status != IssueStatus.NEW:
                session.add(IssueEvent(issue_id=issue.id, status=issue.status.value))
    await session.flush()


async def reset_demo_issues(session):
    # Caller must take a database backup before this explicit destructive operation.
    for model in (StaffNotification, IssueMessage, IssuePhoto, IssueEvent, Issue):
        await session.execute(delete(model))
    houses = list(await session.scalars(select(House).order_by(House.id)))
    for house in houses:
        if not house.address.startswith("г. "):
            house.address = "г. Казань, " + house.address
    await populate_house_examples(session, houses)
    return len(houses) * 2
