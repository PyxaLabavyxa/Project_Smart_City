"""Isolated manual UI check: disposable SQLite, synthetic data, loopback only, no MAX worker."""

import secrets
import tempfile
from datetime import UTC, datetime, timedelta
from pathlib import Path

import uvicorn
from app.database.enums import IssueCategory, IssuePriority, IssueStatus
from app.database.models import (
    Base,
    House,
    Issue,
    IssueEvent,
    IssuePhoto,
    StaffHouse,
    StaffUser,
    User,
)
from pydantic import SecretStr
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from smart_city_api.core.config import Settings
from smart_city_api.core.staff_auth import hash_password
from smart_city_api.main import create_app


def main():
    # No .env is read and no existing database or photo file is modified.
    with tempfile.TemporaryDirectory(prefix="dompulse-staff-ui-") as directory:
        root = Path(directory)
        path = root / "preview.db"
        engine = create_engine(f"sqlite:///{path}")
        Base.metadata.create_all(engine)
        password = secrets.token_urlsafe(18)
        with Session(engine) as session:
            session.add_all(
                [
                    StaffUser(
                        id=1,
                        login="preview",
                        name="Анна Соколова",
                        password_hash=hash_password(password),
                    ),
                    House(
                        id=1,
                        address="ЖК «Сосновый», ул. Лесная, 12",
                        entrances_count=3,
                        floors_count=12,
                        apartments_per_floor=4,
                    ),
                    House(
                        id=2,
                        address="ЖК «Сосновый», ул. Лесная, 14",
                        entrances_count=2,
                        floors_count=12,
                        apartments_per_floor=4,
                    ),
                    User(id=1, max_user_id=999001, name="Александр Ковалёв"),
                    User(id=2, max_user_id=999002, name="Мария Волкова"),
                    User(id=3, max_user_id=999003, name="Дмитрий Орлов"),
                ]
            )
            session.flush()
            session.add_all(
                [StaffHouse(staff_id=1, house_id=1), StaffHouse(staff_id=1, house_id=2)]
            )
            examples = [
                (
                    "Не горит освещение на третьем этаже",
                    "Вечером на лестничной площадке очень темно. Не горят обе лампы у лифта. "
                    "Просьба проверить освещение.",
                    IssueCategory.ELECTRICITY,
                    IssuePriority.HIGH,
                    IssueStatus.NEW,
                ),
                (
                    "Протекает труба в подвале",
                    "Под трубой горячей воды образовалась лужа. Вход в подвал со стороны двора.",
                    IssueCategory.WATER,
                    IssuePriority.HIGH,
                    IssueStatus.IN_PROGRESS,
                ),
                (
                    "Доводчик входной двери требует ремонта",
                    "Дверь хлопает и не всегда закрывается до конца.",
                    IssueCategory.ENTRANCE,
                    IssuePriority.MEDIUM,
                    IssueStatus.NEW,
                ),
                (
                    "Переполнены контейнеры для мусора",
                    "Контейнеры у второго корпуса переполнены уже второй день.",
                    IssueCategory.GARBAGE,
                    IssuePriority.MEDIUM,
                    IssueStatus.IN_PROGRESS,
                ),
                (
                    "Не работает кнопка вызова лифта",
                    "Кнопка первого этажа не реагирует на нажатие.",
                    IssueCategory.ELEVATOR,
                    IssuePriority.HIGH,
                    IssueStatus.RESOLVED,
                ),
                (
                    "Повреждена скамейка во дворе",
                    "Сломана доска у скамейки возле детской площадки.",
                    IssueCategory.YARD,
                    IssuePriority.LOW,
                    IssueStatus.NEW,
                ),
                (
                    "Холодные батареи в подъезде",
                    "Батареи на первом этаже холодные несколько дней.",
                    IssueCategory.HEATING,
                    IssuePriority.MEDIUM,
                    IssueStatus.RESOLVED,
                ),
            ]
            for i, (title, description, category, priority, status) in enumerate(examples, 1):
                created = datetime.now(UTC) - timedelta(hours=i * 4)
                session.add(
                    Issue(
                        id=i,
                        user_id=(i % 3) + 1,
                        house_id=1 if i % 2 else 2,
                        title=title,
                        description=description,
                        category=category,
                        priority=priority,
                        status=status,
                        entrance=1,
                        floor=3,
                        zone="corridor",
                        created_at=created,
                    )
                )
                session.flush()
                session.add(IssueEvent(issue_id=i, status="new", created_at=created))
                if status != IssueStatus.NEW:
                    session.add(
                        IssueEvent(
                            issue_id=i, status=status.value, created_at=created + timedelta(hours=1)
                        )
                    )
            # A real PNG fixture, generated locally; never a public media directory.
            import base64

            photo_directory = root / "media" / "issues"
            photo_directory.mkdir(parents=True)
            (photo_directory / ("a" * 32 + ".png")).write_bytes(
                base64.b64decode(
                    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lE"
                    "QVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII="
                )
            )
            session.add(IssuePhoto(issue_id=1, file_path="issues/" + "a" * 32 + ".png"))
            session.commit()
        engine.dispose()
        settings = Settings(
            _env_file=None,
            database_url=SecretStr(f"sqlite+aiosqlite:///{path}"),
            bot_token=None,
            session_cookie_secure=False,
            media_root=root / "media",
        )
        print(
            "Temporary UI preview: http://127.0.0.1:8765/staff/\n"
            f"Login: preview\nPassword: {password}",
            flush=True,
        )
        uvicorn.run(create_app(settings), host="127.0.0.1", port=8765)


if __name__ == "__main__":
    main()
