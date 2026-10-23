import secrets
from datetime import UTC, datetime, timedelta

from app.database.models import (
    Announcement,
    AnnouncementDelivery,
    AnnouncementPrivateDelivery,
    Apartment,
    House,
    HouseChat,
    HouseWork,
    UserApartment,
)
from app.services.announcement_audience import residents, unavailable_reason
from app.services.house_chats import code_hash, normalize_chat_link
from app.services.inbox import notify_residents
from app.services.planned_works import WorkSchedule, announcement_body, announcement_topic
from fastapi import HTTPException
from sqlalchemy import delete, func, select, update

from smart_city_api.schemas.house_chats import (
    AnnouncementDeliveryOutput,
    AnnouncementOutput,
    ChatOutput,
    PrivateAnnouncementDeliveryOutput,
    ResidentChoice,
)
from smart_city_api.services.contacts import staff_house
from smart_city_api.services.resident_search import matches_resident
from smart_city_api.services.staff import house_scope


async def list_chats(session, staff_id):
    rows = (
        await session.execute(
            select(House, HouseChat)
            .outerjoin(HouseChat, HouseChat.house_id == House.id)
            .where(House.id.in_(house_scope(staff_id)))
            .order_by(House.address)
        )
    ).all()
    return [
        ChatOutput(
            house_id=house.id,
            address=house.address,
            **(
                {
                    k: getattr(chat, k)
                    for k in ("chat_id", "title", "status", "menu_status", "error", "checked_at")
                } | {
                    "revision": chat.revision,
                    "join_url": (
                        normalize_chat_link(chat.join_url)
                        or normalize_chat_link(chat.platform_link)
                    ),
                    "custom_join_url": chat.join_url,
                }
                if chat
                else {}
            ),
        )
        for house, chat in rows
    ]


async def resident_chat(session, house_id):
    chat = await session.get(HouseChat, house_id)
    if not chat or chat.chat_id is None or chat.status == "disconnected":
        return {"status": "not_connected"}
    if chat.status != "connected":
        return {"status": "unavailable"}
    link = normalize_chat_link(chat.join_url) or normalize_chat_link(chat.platform_link)
    if not link:
        return {"status": "link_missing"}
    return {"status": "available", "title": chat.title or "Общий чат дома", "join_url": link}


async def save_chat_link(session, staff_id, house_id, data):
    await staff_house(session, staff_id, house_id, lock=True)
    chat = await session.scalar(
        select(HouseChat).where(HouseChat.house_id == house_id).with_for_update()
    )
    if not chat or chat.chat_id is None:
        raise HTTPException(409, "Сначала подключите домовой чат")
    if chat.chat_id != data.chat_id or chat.revision != data.revision:
        raise HTTPException(409, "Подключение изменилось. Обновите список чатов")
    chat.join_url = data.join_url
    await session.commit()


async def connection_code(session, staff_id, house_id):
    await staff_house(session, staff_id, house_id, lock=True)
    chat = await session.get(HouseChat, house_id)
    if chat and chat.chat_id is not None:
        raise HTTPException(409, "Сначала отключите существующий чат")
    if not chat:
        chat = HouseChat(house_id=house_id, status="disconnected", menu_status="none", revision=0)
        session.add(chat)
    code = secrets.token_hex(12)
    expires = datetime.now(UTC) + timedelta(minutes=15)
    chat.code_hash, chat.code_expires_at, chat.code_staff_id = code_hash(code), expires, staff_id
    await session.commit()
    return {"command": f"/domoved {code}", "expires_at": expires}


async def disconnect(session, staff_id, house_id):
    await staff_house(session, staff_id, house_id, lock=True)
    chat = await session.scalar(
        select(HouseChat).where(HouseChat.house_id == house_id).with_for_update()
    )
    if chat:
        chat.chat_id = chat.code_hash = chat.code_expires_at = chat.code_staff_id = None
        chat.join_url = chat.platform_link = None
        chat.link_checked_at = None
        chat.connected_by = chat.menu_message_id = None
        chat.revision += 1
        chat.status, chat.menu_status, chat.title, chat.error = "disconnected", "none", "", ""
        await session.execute(
            update(AnnouncementDelivery)
            .where(
                AnnouncementDelivery.house_id == house_id,
                AnnouncementDelivery.status.in_(["pending", "failed"]),
            )
            .values(status="cancelled", error="Чат отключён")
        )
    await session.commit()


async def restore_menu(session, staff_id, house_id):
    await staff_house(session, staff_id, house_id, lock=True)
    chat = await session.scalar(
        select(HouseChat).where(HouseChat.house_id == house_id).with_for_update()
    )
    if not chat or chat.chat_id is None:
        raise HTTPException(409, "Сначала подключите чат")
    if chat.menu_status in ("sending", "pending"):
        return
    chat.menu_status = "pending"
    chat.error = ""
    await session.commit()


async def owned_announcement(session, staff_id, announcement_id, *, lock=False):
    statement = select(Announcement).where(
        Announcement.id == announcement_id, Announcement.staff_id == staff_id
    )
    if lock:
        statement = statement.with_for_update()
    row = await session.scalar(statement)
    if row is None:
        raise HTTPException(404, "Рассылка не найдена")
    return row


async def resident_choices(session, staff_id, query="", page=1):
    houses = dict(
        (
            await session.execute(
                select(House.id, House.address).where(House.id.in_(house_scope(staff_id)))
            )
        ).all()
    )
    targets = await residents(session, staff_id, list(houses))
    choices = []
    for uid, target in targets.items():
        user = target["user"]
        addresses = [(houses[h], n) for h, n in target["apartments"]]
        if not matches_resident(query, user.name, user.max_user_id, addresses):
            continue
        reason = unavailable_reason(user)
        choices.append(
            ResidentChoice(
                id=uid,
                name=user.name,
                max_user_id=user.max_user_id,
                apartments=[f"{houses[h]} · кв. {n}" for h, n in target["apartments"]],
                available=not reason,
                reason=reason,
            )
        )
    return {"items": choices[(page - 1) * 50 : page * 50], "total": len(choices)}


async def work_completed_at(session, row):
    if not row.work or row.work.get("ends_at") is not None:
        return None
    value = await session.scalar(
        select(func.min(HouseWork.ends_at)).where(HouseWork.announcement_id == row.id)
    )
    return value.replace(tzinfo=UTC) if value is not None and value.tzinfo is None else value


async def read_announcement(session, staff_id, announcement_id):
    row = await owned_announcement(session, staff_id, announcement_id)
    recipients = (
        await session.execute(
            select(AnnouncementDelivery, House, HouseChat)
            .join(House, House.id == AnnouncementDelivery.house_id)
            .outerjoin(HouseChat, HouseChat.house_id == House.id)
            .where(AnnouncementDelivery.announcement_id == row.id)
            .order_by(House.address)
        )
    ).all()
    private = (
        await session.scalars(
            select(AnnouncementPrivateDelivery)
            .where(AnnouncementPrivateDelivery.announcement_id == row.id)
            .order_by(AnnouncementPrivateDelivery.id)
        )
    ).all()
    targets = (
        await residents(session, staff_id, row.house_ids, [d.user_id for d in private])
        if private
        else {}
    )
    houses = dict(
        (
            await session.execute(
                select(House.id, House.address).where(House.id.in_(house_scope(staff_id)))
            )
        ).all()
    )
    private_output = []
    for d in private:
        target = targets.get(d.user_id)
        user = target["user"] if target else None
        reason = unavailable_reason(user) if user else "Житель больше недоступен в выбранных домах"
        private_output.append(
            PrivateAnnouncementDeliveryOutput(
                user_id=d.user_id,
                name=user.name if user else "Недоступный получатель",
                max_user_id=user.max_user_id if user else None,
                address="; ".join(f"{houses[h]} · кв. {n}" for h, n in target["apartments"])
                if target
                else "",
                available=not reason,
                status=d.status,
                error=d.error or (reason if d.status == "draft" else ""),
                sent_at=d.sent_at,
            )
        )
    return AnnouncementOutput(
        **{
            k: getattr(row, k)
            for k in (
                "id",
                "topic",
                "title",
                "text",
                "status",
                "version",
                "created_at",
                "sent_at",
                "house_ids",
                "channels",
                "resident_ids",
                "audience",
                "excluded_count",
                "work",
            )
        },
        deliveries=[
            AnnouncementDeliveryOutput(
                house_id=d.house_id,
                address=h.address,
                chat_title=c.title if c else "",
                status=d.status,
                error=d.error,
                sent_at=d.sent_at,
            )
            for d, h, c in recipients
        ],
        private_deliveries=private_output,
        message_body=announcement_body(row),
        message_topic=announcement_topic(row),
        work_completed_at=await work_completed_at(session, row),
    )


async def list_announcements(session, staff_id, page):
    ids = (
        await session.scalars(
            select(Announcement.id)
            .where(Announcement.staff_id == staff_id)
            .order_by(Announcement.id.desc())
            .offset((page - 1) * 20)
            .limit(20)
        )
    ).all()
    total = await session.scalar(
        select(func.count()).select_from(Announcement).where(Announcement.staff_id == staff_id)
    )
    return {"items": [await read_announcement(session, staff_id, i) for i in ids], "total": total}


async def save_draft(session, staff_id, data, announcement_id=None):
    houses = set(
        (
            await session.scalars(
                select(House.id).where(
                    House.id.in_(house_scope(staff_id)), House.id.in_(data.house_ids)
                )
            )
        ).all()
    )
    if houses != set(data.house_ids):
        raise HTTPException(404, "Один из выбранных домов недоступен")
    candidates = (
        await residents(
            session,
            staff_id,
            sorted(houses),
            data.resident_ids if data.audience == "residents" else None,
        )
        if "private" in data.channels
        else {}
    )
    if data.audience == "residents" and set(candidates) != set(data.resident_ids):
        raise HTTPException(404, "Один из выбранных жителей недоступен")
    eligible = {
        uid: target for uid, target in candidates.items() if not unavailable_reason(target["user"])
    }
    if announcement_id:
        row = await owned_announcement(session, staff_id, announcement_id, lock=True)
        if row.status != "draft" or row.version != data.version:
            raise HTTPException(409, "Черновик изменился или уже отправлен. Обновите страницу")
        row.version += 1
        for model in (AnnouncementDelivery, AnnouncementPrivateDelivery):
            await session.execute(delete(model).where(model.announcement_id == row.id))
    else:
        row = Announcement(staff_id=staff_id, version=1, status="draft")
        session.add(row)
    row.topic, row.title, row.text = data.topic, data.title, data.text
    row.work = data.work.model_dump(mode="json") if data.work else None
    row.house_ids, row.channels, row.resident_ids = (
        sorted(houses),
        list(data.channels),
        list(data.resident_ids),
    )
    row.audience, row.excluded_count = data.audience, len(candidates) - len(eligible)
    await session.flush()
    if "groups" in data.channels:
        session.add_all(
            AnnouncementDelivery(announcement_id=row.id, house_id=h, status="draft")
            for h in sorted(houses)
        )
    session.add_all(
        AnnouncementPrivateDelivery(announcement_id=row.id, user_id=uid, status="draft")
        for uid in eligible
    )
    await session.commit()
    return await read_announcement(session, staff_id, row.id)


async def publish(session, staff_id, announcement_id, version):
    row = await owned_announcement(session, staff_id, announcement_id, lock=True)
    if row.version != version:
        raise HTTPException(409, "Предпросмотр устарел. Откройте черновик заново")
    for house_id in row.house_ids:
        await staff_house(session, staff_id, house_id)
    if row.status != "draft":
        return await read_announcement(session, staff_id, row.id)
    schedule = WorkSchedule.model_validate(row.work) if row.work else None
    if schedule and schedule.ends_at is not None and schedule.ends_at <= datetime.now(UTC):
        raise HTTPException(422, "Работы уже закончились. Укажите актуальные даты в черновике")
    deliveries = (
        await session.scalars(
            select(AnnouncementDelivery).where(AnnouncementDelivery.announcement_id == row.id)
        )
    ).all()
    for delivery in deliveries:
        chat = await session.get(HouseChat, delivery.house_id)
        if not chat or chat.status != "connected" or chat.menu_status != "ready":
            raise HTTPException(409, "У всех выбранных домов должен быть подключён исправный чат")
        delivery.chat_id, delivery.chat_revision, delivery.status = (
            chat.chat_id,
            chat.revision,
            "pending",
        )
    if schedule and "private" in row.channels:
        # House work notices use the current household audience at publication time.
        candidates = await residents(session, staff_id, row.house_ids)
        row.excluded_count = sum(bool(unavailable_reason(t["user"])) for t in candidates.values())
        existing = set(
            await session.scalars(
                select(AnnouncementPrivateDelivery.user_id).where(
                    AnnouncementPrivateDelivery.announcement_id == row.id
                )
            )
        )
        session.add_all(
            AnnouncementPrivateDelivery(announcement_id=row.id, user_id=uid, status="draft")
            for uid, target in candidates.items()
            if uid not in existing and not unavailable_reason(target["user"])
        )
        await session.flush()
    private = (
        await session.scalars(
            select(AnnouncementPrivateDelivery).where(
                AnnouncementPrivateDelivery.announcement_id == row.id
            )
        )
    ).all()
    targets = (
        await residents(session, staff_id, row.house_ids, [d.user_id for d in private])
        if private
        else {}
    )
    eligible = {uid for uid, t in targets.items() if not unavailable_reason(t["user"])}
    if not deliveries and not eligible and not schedule:
        raise HTTPException(
            409, "Нет доступных получателей. Проверьте выбор жителей и их настройки уведомлений"
        )
    for delivery in private:
        delivery.status = "pending" if delivery.user_id in eligible else "cancelled"
        delivery.error = (
            "" if delivery.user_id in eligible else "Доступ или настройки жителя изменились"
        )
    row.status, row.sent_at = "queued", datetime.now(UTC)
    if schedule:
        session.add_all(
            HouseWork(
                house_id=house_id,
                announcement_id=row.id,
                title=row.title,
                starts_at=schedule.starts_at,
                ends_at=schedule.ends_at,
                location=schedule.location,
            )
            for house_id in row.house_ids
        )
    if schedule:
        # One inbox entry per resident, pointing to an affected house they belong to.
        members = await session.execute(
            select(UserApartment.user_id, Apartment.house_id)
            .join(Apartment, Apartment.id == UserApartment.apartment_id)
            .where(Apartment.house_id.in_(row.house_ids))
            .distinct()
            .order_by(Apartment.house_id, UserApartment.user_id)
        )
        homes = {}
        for user_id, house_id in members:
            homes.setdefault(user_id, house_id)
        for house_id in row.house_ids:
            await notify_residents(
                session,
                [uid for uid, home in homes.items() if home == house_id],
                key=f"announcement:{row.id}",
                kind="announcement",
                title="Работы в доме: " + row.title,
                body=announcement_body(row),
                house_id=house_id,
                href="/",
            )
    else:
        recipients = (
            select(UserApartment.user_id)
            .join(Apartment, Apartment.id == UserApartment.apartment_id)
            .where(Apartment.house_id.in_(row.house_ids))
        )
        if row.audience == "residents":
            recipients = recipients.where(UserApartment.user_id.in_(row.resident_ids))
        await notify_residents(
            session,
            await session.scalars(recipients.distinct()),
            key=f"announcement:{row.id}",
            kind="announcement",
            title="Объявление УК: " + row.title,
            body=row.text,
        )
    await session.commit()
    return await read_announcement(session, staff_id, row.id)


async def complete_work(session, staff_id, announcement_id, version):
    row = await owned_announcement(session, staff_id, announcement_id, lock=True)
    if row.version != version:
        raise HTTPException(409, "Публикация изменилась. Откройте её заново")
    if row.status == "draft" or not row.work or row.work.get("ends_at") is not None:
        raise HTTPException(409, "Вручную завершаются только опубликованные работы без срока")
    for house_id in row.house_ids:
        await staff_house(session, staff_id, house_id)
    now = datetime.now(UTC)
    if WorkSchedule.model_validate(row.work).starts_at >= now:
        raise HTTPException(409, "Работа ещё не началась")
    # Keep the published notice immutable. Only the calendar records the actual end.
    await session.execute(
        update(HouseWork)
        .where(HouseWork.announcement_id == row.id, HouseWork.ends_at.is_(None))
        .values(ends_at=now)
    )
    for model in (AnnouncementDelivery, AnnouncementPrivateDelivery):
        await session.execute(
            update(model)
            .where(model.announcement_id == row.id, model.status.in_(("pending", "failed")))
            .values(status="cancelled", error="Работа уже завершена")
        )
    await session.commit()
    return await read_announcement(session, staff_id, row.id)


async def retry_failed(session, staff_id, announcement_id):
    row = await owned_announcement(session, staff_id, announcement_id, lock=True)
    if await work_completed_at(session, row):
        raise HTTPException(409, "Работа уже завершена, повторная рассылка не требуется")
    deliveries = (
        await session.scalars(
            select(AnnouncementDelivery)
            .where(
                AnnouncementDelivery.announcement_id == row.id,
                AnnouncementDelivery.status == "failed",
            )
            .with_for_update()
        )
    ).all()
    for d in deliveries:
        await staff_house(session, staff_id, d.house_id)
        chat = await session.get(HouseChat, d.house_id)
        if (
            not chat
            or chat.status != "connected"
            or chat.menu_status != "ready"
            or chat.chat_id != d.chat_id
            or chat.revision != d.chat_revision
        ):
            raise HTTPException(
                409,
                "Чат изменился или недоступен. Создайте новый черновик после проверки подключения",
            )
        d.status, d.error = "pending", ""
    private = (
        await session.scalars(
            select(AnnouncementPrivateDelivery)
            .where(
                AnnouncementPrivateDelivery.announcement_id == row.id,
                AnnouncementPrivateDelivery.status == "failed",
            )
            .with_for_update()
        )
    ).all()
    targets = (
        await residents(session, staff_id, row.house_ids, [d.user_id for d in private])
        if private
        else {}
    )
    for d in private:
        target = targets.get(d.user_id)
        if not target or unavailable_reason(target["user"]):
            raise HTTPException(
                409,
                "Жителю нужно открыть бота, включить объявления "
                "и сохранить привязку к выбранному дому",
            )
        d.status, d.error = "pending", ""
    await session.commit()
    return await read_announcement(session, staff_id, row.id)
