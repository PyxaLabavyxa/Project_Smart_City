"""Resident audience shared by the API and the bot delivery worker."""

from sqlalchemy import select

from app.database.models import Apartment, StaffHouse, StaffUser, User, UserApartment


async def residents(session, staff_id, house_ids, user_ids=None):
    query = (
        select(User, Apartment.house_id, Apartment.number)
        .join(UserApartment, UserApartment.user_id == User.id)
        .join(Apartment, Apartment.id == UserApartment.apartment_id)
        .join(StaffHouse, StaffHouse.house_id == Apartment.house_id)
        .join(StaffUser, StaffUser.id == StaffHouse.staff_id)
        .where(
            StaffHouse.staff_id == staff_id,
            StaffUser.active.is_(True),
            Apartment.house_id.in_(house_ids),
        )
        .order_by(User.name, User.id, Apartment.house_id, Apartment.number)
    )
    if user_ids is not None:
        query = query.where(User.id.in_(user_ids))
    result = {}
    for user, house_id, apartment in (await session.execute(query)).all():
        target = result.setdefault(user.id, {"user": user, "apartments": []})
        target["apartments"].append((house_id, apartment))
    return result


def unavailable_reason(user):
    if not user.bot_dialog_started:
        return "Жителю нужно открыть бота и нажать /start"
    if not user.notify_announcements:
        return "Житель отключил уведомления об объявлениях"
    return ""
