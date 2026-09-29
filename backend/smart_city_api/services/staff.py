import hashlib
import json

from app.database.enums import IssuePriority, IssueStatus
from app.database.models import (
    Apartment,
    House,
    Issue,
    IssueEvent,
    IssueMessage,
    IssuePhoto,
    StaffHouse,
    StaffNotification,
    StaffUser,
    User,
)
from fastapi import HTTPException
from sqlalchemy import func, or_, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from smart_city_api.schemas.staff import (
    ActionOutput,
    DeliveryOutput,
    EventOutput,
    IssueDetail,
    IssueRow,
    MessageInput,
    MessageOutput,
    PhotoOutput,
    StaffIssuePage,
    StatusInput,
)


def house_scope(staff_id: int):
    return select(StaffHouse.house_id).where(StaffHouse.staff_id == staff_id)


async def accessible_issue(session: AsyncSession, staff_id: int, issue_id: int) -> Issue:
    issue = await session.scalar(
        select(Issue).where(Issue.id == issue_id, Issue.house_id.in_(house_scope(staff_id)))
    )
    if issue is None:
        raise HTTPException(404, "Обращение не найдено или недоступно")
    return issue


def row_query():
    photos = (
        select(IssuePhoto.issue_id, func.count(IssuePhoto.id).label("count"))
        .group_by(IssuePhoto.issue_id)
        .subquery()
    )
    return (
        select(Issue, House.address, User.name, Apartment.number, func.coalesce(photos.c.count, 0))
        .join(House, House.id == Issue.house_id)
        .join(User, User.id == Issue.user_id)
        .outerjoin(Apartment, Apartment.id == Issue.apartment_id)
        .outerjoin(photos, photos.c.issue_id == Issue.id)
    )


def issue_row(row) -> IssueRow:
    issue, address, author, apartment, photo_count = row
    return IssueRow(
        id=issue.id,
        title=issue.title,
        description=issue.description,
        category=issue.category,
        priority=issue.priority,
        status=issue.status,
        created_at=issue.created_at,
        house_id=issue.house_id,
        address=address,
        author=author,
        entrance=issue.entrance,
        floor=issue.floor,
        zone=issue.zone,
        apartment=apartment,
        photo_count=photo_count,
    )


async def list_issues(
    session: AsyncSession,
    staff_id: int,
    house_id: int | None,
    status: IssueStatus | None,
    priority: IssuePriority | None,
    query: str,
    page: int,
    page_size: int,
) -> StaffIssuePage:
    conditions = [Issue.house_id.in_(house_scope(staff_id))]
    if house_id is not None:
        conditions.append(Issue.house_id == house_id)
    if priority is not None:
        conditions.append(Issue.priority == priority)
    if query.strip():
        value = query.strip()
        choices = [
            Issue.title.icontains(value, autoescape=True),
            Issue.description.icontains(value, autoescape=True),
        ]
        if value.lstrip("#").isdigit() and len(value) < 12:
            choices.append(Issue.id == int(value.lstrip("#")))
        conditions.append(or_(*choices))
    grouped = (
        await session.execute(
            select(Issue.status, func.count()).where(*conditions).group_by(Issue.status)
        )
    ).all()
    counts = {state.value: 0 for state in IssueStatus}
    counts.update({state.value: count for state, count in grouped})
    total = counts[status.value] if status else sum(counts.values())
    if status is not None:
        conditions.append(Issue.status == status)
    rows = (
        await session.execute(
            row_query()
            .where(*conditions)
            .order_by(Issue.created_at.desc(), Issue.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ).all()
    return StaffIssuePage(
        items=[issue_row(row) for row in rows],
        total=total,
        page=page,
        page_size=page_size,
        counts=counts,
    )


async def detail(session: AsyncSession, staff_id: int, issue_id: int) -> IssueDetail:
    row = (
        await session.execute(
            row_query().where(Issue.id == issue_id, Issue.house_id.in_(house_scope(staff_id)))
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(404, "Обращение не найдено или недоступно")
    photos = (
        await session.scalars(
            select(IssuePhoto).where(IssuePhoto.issue_id == issue_id).order_by(IssuePhoto.id)
        )
    ).all()
    events = (
        await session.scalars(
            select(IssueEvent)
            .where(IssueEvent.issue_id == issue_id)
            .order_by(IssueEvent.id.desc())
            .limit(100)
        )
    ).all()
    messages = (
        await session.execute(
            select(IssueMessage, StaffUser.name, User.name)
            .outerjoin(StaffUser, StaffUser.id == IssueMessage.staff_id)
            .outerjoin(User, User.id == IssueMessage.user_id)
            .where(IssueMessage.issue_id == issue_id)
            .order_by(IssueMessage.id.desc())
            .limit(200)
        )
    ).all()
    notifications = (
        await session.execute(
            select(StaffNotification, StaffUser.name)
            .join(StaffUser, StaffUser.id == StaffNotification.staff_id)
            .where(StaffNotification.issue_id == issue_id)
            .order_by(StaffNotification.id.desc())
            .limit(200)
        )
    ).all()
    return IssueDetail(
        **issue_row(row).model_dump(),
        photos=[PhotoOutput(id=p.id, url=f"/api/v1/staff/photos/{p.id}") for p in photos],
        history=[EventOutput(status=e.status, created_at=e.created_at) for e in reversed(events)],
        messages=[
            MessageOutput(
                id=m.id,
                direction="staff" if m.staff_id else "resident",
                author=staff_name if m.staff_id else resident_name,
                text=m.text,
                created_at=m.created_at,
            )
            for m, staff_name, resident_name in reversed(messages)
        ],
        notifications=[
            DeliveryOutput(
                id=n.id,
                kind=n.kind,
                status=n.status,
                message_id=n.message_id,
                author=name,
                delivery="sent" if n.sent_at else "retrying" if n.attempts else "pending",
                created_at=n.created_at,
            )
            for n, name in notifications
        ],
    )


def action_hash(issue_id: int, kind: str, body: StatusInput | MessageInput) -> str:
    data = {"issue_id": issue_id, "kind": kind, **body.model_dump(mode="json")}
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


async def previous_action(session, staff_id, request_id, fingerprint) -> ActionOutput | None:
    previous = await session.scalar(
        select(StaffNotification).where(
            StaffNotification.staff_id == staff_id, StaffNotification.request_id == str(request_id)
        )
    )
    if previous:
        if previous.request_hash != fingerprint:
            raise HTTPException(409, "Этот запрос уже использован. Обновите страницу")
        return ActionOutput(notification_id=previous.id)
    return None


STATUS_TEXT = {
    IssueStatus.NEW: (
        "📋 Обращение №{id} снова ожидает обработки",
        "Сотрудник вернул обращение в очередь. Сообщим, когда начнётся работа.",
    ),
    IssueStatus.IN_PROGRESS: (
        "🛠 Обращение №{id} взято в работу",
        "Сотрудник управляющей компании приступил к обработке. "
        "Когда статус изменится, мы сообщим вам здесь.",
    ),
    IssueStatus.RESOLVED: (
        "✅ Обращение №{id} отмечено как решённое",
        "Проверьте, устранена ли проблема. Если она осталась, "
        "нажмите «Ответить сотруднику» и расскажите об этом.",
    ),
}


async def perform_action(
    session: AsyncSession,
    staff: StaffUser,
    issue_id: int,
    body: StatusInput | MessageInput,
) -> ActionOutput:
    kind = "status" if isinstance(body, StatusInput) else "message"
    staff_id = staff.id
    fingerprint = action_hash(issue_id, kind, body)
    issue = await accessible_issue(session, staff.id, issue_id)
    prior = await previous_action(session, staff.id, body.request_id, fingerprint)
    if prior:
        return prior
    author = await session.get(User, issue.user_id)
    house = await session.get(House, issue.house_id)
    message = None
    if isinstance(body, StatusInput):
        if issue.status != body.expected_status:
            raise HTTPException(409, "Статус уже изменён другим сотрудником. Обновите обращение")
        if body.status == issue.status:
            return ActionOutput(notification_id=None, changed=False)
        # Compare-and-swap also protects concurrent updates on SQLite (FOR UPDATE is ignored there).
        changed = await session.execute(
            update(Issue)
            .where(
                Issue.id == issue.id,
                Issue.status == body.expected_status,
            )
            .values(status=body.status)
        )
        if changed.rowcount != 1:
            await session.rollback()
            prior = await previous_action(session, staff_id, body.request_id, fingerprint)
            if prior:
                return prior
            raise HTTPException(409, "Статус уже изменён. Обновите обращение")
        session.add(IssueEvent(issue_id=issue.id, status=body.status.value))
        heading, explanation = STATUS_TEXT[body.status]
        text = (
            f"{heading.format(id=issue.id)}\n\n{issue.title}\n📍 {house.address}\n\n{explanation}"
        )
    else:
        message = IssueMessage(
            issue_id=issue.id,
            staff_id=staff.id,
            text=body.text,
            request_id=f"staff:{staff.id}:{body.request_id}",
        )
        session.add(message)
        text = (
            f"💬 Уточнение по обращению №{issue.id}\n\n{issue.title}\n📍 {house.address}\n\n"
            f"{staff.name}, управляющая компания:\n{body.text}\n\n"
            "Нажмите «Ответить сотруднику», чтобы отправить ответ по этому обращению."
        )
    try:
        await session.flush()
        notification = StaffNotification(
            issue_id=issue.id,
            staff_id=staff.id,
            max_user_id=author.max_user_id,
            kind=kind,
            status=body.status.value if isinstance(body, StatusInput) else None,
            message_id=message.id if message else None,
            text=text,
            request_id=str(body.request_id),
            request_hash=fingerprint,
        )
        session.add(notification)
        await session.flush()
        result = ActionOutput(notification_id=notification.id)
        await session.commit()
        return result
    except IntegrityError:
        await session.rollback()
        prior = await previous_action(session, staff_id, body.request_id, fingerprint)
        if prior:
            return prior
        raise
