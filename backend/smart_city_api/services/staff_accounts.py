import asyncio
import logging

from app.database.models import (
    Apartment,
    ApartmentMessage,
    Issue,
    IssueEvent,
    IssueMessage,
    IssuePhoto,
    MessageNotification,
    Meter,
    MeterReading,
    MiniAppPresence,
    RegistrationRequest,
    StaffNotification,
    User,
    UserApartment,
    UtilityAccount,
)
from app.paths import project_path
from fastapi import HTTPException
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.services.photos import photo_path
from smart_city_api.services.staff import house_scope

logger = logging.getLogger(__name__)


async def delete_registered_user(
    session: AsyncSession, staff_id: int, application_id: int, media_root
):
    user = await session.scalar(
        select(User)
        .join(RegistrationRequest, RegistrationRequest.user_id == User.id)
        .join(Apartment, Apartment.id == RegistrationRequest.apartment_id)
        .where(
            RegistrationRequest.id == application_id,
            RegistrationRequest.status == "approved",
            Apartment.house_id.in_(house_scope(staff_id)),
        )
        .with_for_update(of=User)
    )
    if user is None:
        raise HTTPException(404, "Зарегистрированный пользователь не найден или недоступен")
    uid, max_id = user.id, user.max_user_id
    managed = house_scope(staff_id)
    # A company must not erase an account associated with another company's houses.
    checks = [
        select(UserApartment.id)
        .join(Apartment)
        .where(UserApartment.user_id == uid, ~Apartment.house_id.in_(managed)),
        select(RegistrationRequest.id)
        .join(Apartment)
        .where(RegistrationRequest.user_id == uid, ~Apartment.house_id.in_(managed)),
        select(Issue.id).where(Issue.user_id == uid, ~Issue.house_id.in_(managed)),
        select(ApartmentMessage.id)
        .join(Apartment, Apartment.id == ApartmentMessage.sender_id)
        .where(ApartmentMessage.user_id == uid, ~Apartment.house_id.in_(managed)),
        select(MeterReading.id)
        .join(Meter)
        .join(UtilityAccount)
        .join(Apartment)
        .where(MeterReading.user_id == uid, ~Apartment.house_id.in_(managed)),
        select(IssueMessage.id)
        .join(Issue)
        .where(IssueMessage.user_id == uid, ~Issue.house_id.in_(managed)),
    ]
    for query in checks:
        if await session.scalar(query.limit(1)) is not None:
            raise HTTPException(
                409,
                "У пользователя есть данные в доме другой УК. Удаление всего аккаунта недоступно",
            )
    # Wait for in-flight issue actions before deleting their notification dependencies.
    await session.execute(select(Issue.id).where(Issue.user_id == uid).with_for_update())
    await session.execute(
        select(ApartmentMessage.id).where(ApartmentMessage.user_id == uid).with_for_update()
    )
    await session.execute(
        select(IssueMessage.id).where(IssueMessage.user_id == uid).with_for_update()
    )
    issues = select(Issue.id).where(Issue.user_id == uid)
    messages = select(ApartmentMessage.id).where(ApartmentMessage.user_id == uid)
    replies = select(IssueMessage.id).where(IssueMessage.user_id == uid)
    keys = list(
        await session.scalars(select(IssuePhoto.file_path).where(IssuePhoto.issue_id.in_(issues)))
    )
    operations = [
        delete(StaffNotification).where(
            or_(
                StaffNotification.issue_id.in_(issues),
                StaffNotification.message_id.in_(replies),
                StaffNotification.max_user_id == max_id,
            )
        ),
        delete(IssueMessage).where(
            or_(IssueMessage.issue_id.in_(issues), IssueMessage.user_id == uid)
        ),
        delete(IssuePhoto).where(IssuePhoto.issue_id.in_(issues)),
        delete(IssueEvent).where(IssueEvent.issue_id.in_(issues)),
        delete(Issue).where(Issue.user_id == uid),
        delete(MessageNotification).where(
            or_(
                MessageNotification.message_id.in_(messages),
                MessageNotification.max_user_id == max_id,
            )
        ),
        delete(ApartmentMessage).where(ApartmentMessage.user_id == uid),
        delete(MeterReading).where(MeterReading.user_id == uid),
        delete(MiniAppPresence).where(MiniAppPresence.user_id == uid),
        delete(RegistrationRequest).where(RegistrationRequest.user_id == uid),
        delete(UserApartment).where(UserApartment.user_id == uid),
        delete(User).where(User.id == uid),
    ]
    for operation in operations:
        await session.execute(operation.execution_options(synchronize_session=False))
    # Shared photo keys must survive even if an imported database reused a file.
    removable = []
    for key in set(keys):
        if (
            await session.scalar(select(IssuePhoto.id).where(IssuePhoto.file_path == key).limit(1))
            is None
        ):
            removable.append(key)
    await session.commit()
    for key in removable:
        try:
            path = await asyncio.to_thread(photo_path, project_path(media_root), key)
            await asyncio.to_thread(path.unlink, missing_ok=True)
        except FileNotFoundError:
            pass
        except (OSError, ValueError):
            logger.warning("Could not remove an unreferenced resident photo")
