from datetime import UTC, datetime

from sqlalchemy import select

from app.database.models import (
    Apartment,
    CompanyHouse,
    House,
    ManagementCompany,
    RegistrationRequest,
    User,
    UserApartment,
)

WELCOME = (
    "👋 Добро пожаловать в ДомПульс!\n\n🏡 Здесь ваш дом всегда на связи: "
    "сообщайте о проблемах, следите за их решением и общайтесь с УК.\n\n"
    "🔑 Вам пока не назначены квартиры. Для назначения обратитесь в свою УК "
    "или оставьте заявку в зарегистрированную управляющую компанию."
)
TEST_NOTICE = "🧪 Тестовый режим: все заявки принимаются автоматически."


def normalize_name(name):
    name = " ".join(name.split())
    if not 2 <= len(name) <= 200:
        raise ValueError("Укажите ФИО: от 2 до 200 символов")
    return name


async def registration_state(session, user_id):
    user = await session.get(User, user_id)
    complete = await session.scalar(
        select(UserApartment.id).where(UserApartment.user_id == user_id).limit(1)
    )
    latest = await session.scalar(
        select(RegistrationRequest)
        .where(RegistrationRequest.user_id == user_id)
        .order_by(RegistrationRequest.id.desc())
        .limit(1)
    )
    return {
        "name": user.name,
        "complete": complete is not None,
        "status": latest.status if latest else None,
    }


async def catalog(session):
    rows = (
        await session.execute(
            select(ManagementCompany, House)
            .join(CompanyHouse, CompanyHouse.company_id == ManagementCompany.id)
            .join(House, House.id == CompanyHouse.house_id)
            .order_by(ManagementCompany.id, House.id)
        )
    ).all()
    companies = {}
    for company, house in rows:
        entry = companies.setdefault(
            company.id, {"id": company.id, "name": company.name, "houses": []}
        )
        entry["houses"].append(
            {
                "id": house.id,
                "address": house.address,
                "floors": house.floors_count,
                "apartments_count": house.entrances_count
                * house.floors_count
                * house.apartments_per_floor,
            }
        )
    return list(companies.values())


async def submit_registration(
    session,
    user_id,
    *,
    full_name,
    company_id,
    house_id,
    apartment_number,
    source,
    auto_approve=False,
    additional=False,
):
    user = await session.scalar(select(User).where(User.id == user_id).with_for_update())
    state = await registration_state(session, user_id)
    if not additional and (state["complete"] or state["status"] == "pending"):
        return state
    name = normalize_name(full_name)
    membership = await session.get(CompanyHouse, house_id)
    if membership is None or membership.company_id != company_id:
        raise ValueError("Выберите дом, который обслуживает выбранная УК")
    apartment = await session.scalar(
        select(Apartment).where(
            Apartment.house_id == house_id, Apartment.number == apartment_number
        )
    )
    if apartment is None:
        raise ValueError("Такой квартиры в выбранном доме нет. Проверьте номер")
    linked = await session.scalar(
        select(UserApartment.id).where(
            UserApartment.user_id == user_id, UserApartment.apartment_id == apartment.id
        )
    )
    if linked is not None:
        return {**state, "application_status": "approved", "apartment_id": apartment.id}
    pending = await session.scalar(
        select(RegistrationRequest.id)
        .where(
            RegistrationRequest.user_id == user_id,
            RegistrationRequest.apartment_id == apartment.id,
            RegistrationRequest.status == "pending",
        )
        .limit(1)
    )
    if pending is not None:
        return {**state, "application_status": "pending", "apartment_id": apartment.id}
    user.name = name
    application = RegistrationRequest(
        user_id=user_id,
        company_id=company_id,
        apartment_id=apartment.id,
        full_name=name,
        source=source,
        status="approved" if auto_approve else "pending",
        auto_approved=auto_approve,
        decided_at=datetime.now(UTC) if auto_approve else None,
    )
    session.add(application)
    if auto_approve:
        session.add(UserApartment(user_id=user_id, apartment_id=apartment.id))
    await session.flush()
    return {
        **await registration_state(session, user_id),
        "application_status": application.status,
        "apartment_id": apartment.id,
    }


async def decide_registration(session, application, *, approve, staff_id):
    if application.status != "pending":
        raise ValueError("Заявка уже рассмотрена")
    await session.scalar(select(User.id).where(User.id == application.user_id).with_for_update())
    if approve:
        linked = await session.scalar(
            select(UserApartment.id).where(
                UserApartment.user_id == application.user_id,
                UserApartment.apartment_id == application.apartment_id,
            )
        )
        if linked is None:
            session.add(
                UserApartment(user_id=application.user_id, apartment_id=application.apartment_id)
            )
    application.status = "approved" if approve else "rejected"
    application.decided_at = datetime.now(UTC)
    application.decided_by = staff_id
    await session.flush()
