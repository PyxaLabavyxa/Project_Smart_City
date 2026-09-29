import argparse
import asyncio
import getpass
import re

from app.database.models import House, StaffHouse, StaffSession, StaffUser
from sqlalchemy import delete, select

from smart_city_api.core.config import Settings
from smart_city_api.core.staff_auth import hash_password
from smart_city_api.db.session import Database
from smart_city_api.runtime import loop_factory


async def manage(session, command, login, *, name=None, houses=None, password=None):
    login = login.strip().lower()
    if not re.fullmatch(r"[a-z0-9_.-]{3,80}", login):
        raise ValueError("Логин: 3–80 символов, латинские буквы, цифры, _, . или -")
    if password is not None and (not 12 <= len(password) <= 256 or not password.strip()):
        raise ValueError("Пароль должен содержать от 12 до 256 символов")
    ids = sorted(set(houses or []))
    if command in ("create", "assign"):
        found = set(await session.scalars(select(House.id).where(House.id.in_(ids))))
        if not ids or found != set(ids):
            raise ValueError("Укажите хотя бы один существующий дом. Посмотреть дома: list")
    employee = await session.scalar(
        select(StaffUser).where(StaffUser.login == login).with_for_update()
    )
    if command == "create":
        if employee:
            raise ValueError("Логин уже существует. Используйте assign, password или enable")
        if not name or not 1 <= len(name.strip()) <= 200 or password is None:
            raise ValueError("Укажите имя сотрудника (до 200 символов) и пароль")
        employee = StaffUser(
            login=login,
            name=name.strip(),
            password_hash=await asyncio.to_thread(hash_password, password),
        )
        session.add(employee)
        await session.flush()
    elif employee is None:
        raise ValueError("Сотрудник не найден")
    if command in ("create", "assign"):
        await session.execute(delete(StaffHouse).where(StaffHouse.staff_id == employee.id))
        session.add_all([StaffHouse(staff_id=employee.id, house_id=i) for i in ids])
    elif command == "password":
        if password is None:
            raise ValueError("Введите новый пароль")
        employee.password_hash = await asyncio.to_thread(hash_password, password)
    elif command in ("disable", "enable"):
        employee.active = command == "enable"
    elif command != "create":
        raise ValueError("Неизвестная команда")
    await session.execute(delete(StaffSession).where(StaffSession.staff_id == employee.id))


def parser():
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    commands.add_parser("list", help="Показать дома и сотрудников")
    for command in ("create", "assign", "password", "disable", "enable"):
        child = commands.add_parser(command)
        child.add_argument("login")
        if command == "create":
            child.add_argument("--name", required=True)
        if command in ("create", "assign"):
            child.add_argument("--house", type=int, action="append", required=True)
    return result


async def run(args, password):
    settings = Settings()
    if not settings.database_url:
        raise ValueError("Сначала настройте DATABASE_URL и примените миграции")
    database = Database(settings.database_url.get_secret_value())
    try:
        async with database.sessions.begin() as session:
            if args.command == "list":
                for house in await session.scalars(select(House).order_by(House.id)):
                    print(f"Дом #{house.id}: {house.address}")
                for employee in await session.scalars(select(StaffUser).order_by(StaffUser.id)):
                    houses = list(
                        await session.scalars(
                            select(StaffHouse.house_id).where(StaffHouse.staff_id == employee.id)
                        )
                    )
                    print(
                        f"{employee.login}: {employee.name}; "
                        f"active={employee.active}; дома={houses}"
                    )
                return
            await manage(
                session,
                args.command,
                args.login,
                name=getattr(args, "name", None),
                houses=getattr(args, "house", None),
                password=password,
            )
        print("Готово. Изменения сохранены. Сотрудник может войти на /staff/.")
    finally:
        await database.close()


def main():
    args = parser().parse_args()
    password = None
    if args.command in ("create", "password"):
        password = getpass.getpass("Пароль (минимум 12 символов): ")
        if password != getpass.getpass("Повторите пароль: "):
            raise SystemExit("Пароли не совпадают. Изменений нет.")
    try:
        asyncio.run(run(args, password), loop_factory=loop_factory)
    except ValueError as exc:
        raise SystemExit(str(exc)) from None


if __name__ == "__main__":
    main()
