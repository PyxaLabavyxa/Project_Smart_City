"""Write inbox events in the same transaction as the event, never send messages."""

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from app.database.models import InboxNotification, StaffHouse, StaffUser


async def notify_residents(
    session,
    user_ids,
    *,
    key,
    kind,
    title,
    body,
    house_id=None,
    apartment_id=None,
    href=None,
):
    await _insert(
        session,
        "user_id",
        user_ids,
        key=key,
        kind=kind,
        title=title,
        body=body,
        house_id=house_id,
        apartment_id=apartment_id,
        href=href,
    )


async def notify_staff(
    session, house_id, *, key, kind, title, body, href, exclude=None
):
    query = (
        select(StaffUser.id)
        .join(StaffHouse)
        .where(StaffHouse.house_id == house_id, StaffUser.active.is_(True))
    )
    if exclude is not None:
        query = query.where(StaffUser.id != exclude)
    staff = await session.scalars(query)
    await _insert(
        session,
        "staff_id",
        staff,
        key=key,
        kind=kind,
        title=title,
        body=body,
        house_id=house_id,
        apartment_id=None,
        href=href,
    )


async def _insert(
    session, owner, ids, *, key, kind, title, body, house_id, apartment_id, href
):
    values = [
        {
            owner: ident,
            "event_key": key,
            "kind": kind,
            "title": title[:240],
            "body": body[:5000],
            "house_id": house_id,
            "apartment_id": apartment_id,
            "href": href,
        }
        for ident in sorted({ident for ident in ids if ident is not None})
    ]
    if not values:
        return
    insert = pg_insert if session.bind.dialect.name == "postgresql" else sqlite_insert
    # Bounded batches also work on SQLite builds with a small bind parameter limit.
    for start in range(0, len(values), 75):
        await session.execute(
            insert(InboxNotification)
            .values(values[start : start + 75])
            .on_conflict_do_nothing()
        )


async def issue_created(session, issue, *, staff_id=None):
    await notify_staff(
        session,
        issue.house_id,
        key=f"issue:{issue.id}:created",
        kind="issue_created",
        title=f"Новое обращение №{issue.id}",
        body=issue.title,
        href=f"#issue-{issue.id}",
        exclude=staff_id,
    )
    if staff_id is not None and issue.user_id is not None:
        await notify_residents(
            session,
            [issue.user_id],
            key=f"issue:{issue.id}:created",
            kind="issue_created",
            title=f"УК создала обращение №{issue.id}",
            body=issue.title,
            house_id=issue.house_id,
            href=f"/issues/{issue.id}",
        )
