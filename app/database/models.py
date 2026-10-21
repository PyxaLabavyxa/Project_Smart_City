from datetime import datetime, date
from decimal import Decimal

from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy import (
    Integer,
    String,
    BigInteger,
    SmallInteger,
    ForeignKey,
    Text,
    Enum as SqlEnum,
    DateTime,
    func,
    UniqueConstraint
)
from sqlalchemy import JSON, Numeric, Date, Boolean, CheckConstraint, true, false

from app.database.enums import IssueCategory, IssuePriority, IssueStatus


class Base(DeclarativeBase):
    pass


class HouseChat(Base):
    __tablename__ = "house_chats"

    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), primary_key=True)
    chat_id: Mapped[int | None] = mapped_column(BigInteger, unique=True)
    title: Mapped[str] = mapped_column(String(200), default="", server_default="")
    status: Mapped[str] = mapped_column(String(20), default="disconnected")
    revision: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    code_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    code_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"))
    code_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    connected_by: Mapped[int | None] = mapped_column(BigInteger)
    checked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    menu_message_id: Mapped[str | None] = mapped_column(String(200))
    menu_status: Mapped[str] = mapped_column(String(20), default="none")
    menu_attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str] = mapped_column(String(300), default="", server_default="")
    __table_args__ = (
        CheckConstraint("status IN ('disconnected','connected','attention')", name="ck_house_chat_status"),
        CheckConstraint("menu_status IN ('none','pending','sending','ready','failed','uncertain')", name="ck_house_chat_menu"),
    )


class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_users.id"), index=True)
    topic: Mapped[str] = mapped_column(String(20))
    title: Mapped[str] = mapped_column(String(150))
    text: Mapped[str] = mapped_column(String(3000))
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    house_ids: Mapped[list[int]] = mapped_column(JSON, default=list, server_default="[]")
    channels: Mapped[list[str]] = mapped_column(JSON, default=lambda: ["groups"], server_default='["groups"]')
    resident_ids: Mapped[list[int]] = mapped_column(JSON, default=list, server_default="[]")
    audience: Mapped[str] = mapped_column(String(20), default="houses", server_default="houses")
    excluded_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (
        CheckConstraint("status IN ('draft','queued')", name="ck_announcement_status"),
        CheckConstraint("topic IN ('outage','works','meeting','other')", name="ck_announcement_topic"),
    )


class AnnouncementDelivery(Base):
    __tablename__ = "announcement_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    announcement_id: Mapped[int] = mapped_column(ForeignKey("announcements.id", ondelete="CASCADE"), index=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"))
    chat_id: Mapped[int | None] = mapped_column(BigInteger)
    chat_revision: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    message_id: Mapped[str | None] = mapped_column(String(200))
    attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str] = mapped_column(String(300), default="", server_default="")
    __table_args__ = (
        UniqueConstraint("announcement_id", "house_id", name="uq_announcement_house"),
        CheckConstraint("status IN ('draft','pending','sending','sent','failed','uncertain','cancelled')", name="ck_announcement_delivery"),
    )


class AnnouncementPrivateDelivery(Base):
    __tablename__ = "announcement_private_deliveries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    announcement_id: Mapped[int] = mapped_column(ForeignKey("announcements.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", index=True)
    message_id: Mapped[str | None] = mapped_column(String(200))
    attempted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    error: Mapped[str] = mapped_column(String(300), default="", server_default="")
    __table_args__ = (
        UniqueConstraint("announcement_id", "user_id", name="uq_announcement_resident"),
        CheckConstraint("status IN ('draft','pending','sending','sent','failed','uncertain','cancelled')", name="ck_announcement_private_delivery"),
    )


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    max_user_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    name: Mapped[str] = mapped_column(String(200))
    bot_dialog_started: Mapped[bool] = mapped_column(Boolean, default=False, server_default=false())
    notify_personal_messages: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    notify_issue_messages: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    notify_issue_statuses: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    notify_announcements: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())

    apartment_links: Mapped[list["UserApartment"]] = relationship(
        "UserApartment",
        back_populates="user"
    )

    issues: Mapped[list["Issue"]] = relationship(
        "Issue",
        back_populates="user"
    )


class House(Base):
    __tablename__ = "houses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    address: Mapped[str] = mapped_column(String(300))
    entrances_count: Mapped[int] = mapped_column(SmallInteger)
    floors_count: Mapped[int] = mapped_column(SmallInteger)
    apartments_per_floor: Mapped[int] = mapped_column(SmallInteger)

    apartments: Mapped[list["Apartment"]] = relationship(
        "Apartment",
        back_populates="house"
    )

    issues: Mapped[list["Issue"]] = relationship(
        "Issue",
        back_populates="house"
    )


class Apartment(Base):
    __tablename__ = "apartments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"))
    number: Mapped[int] = mapped_column(Integer)
    entrance: Mapped[int] = mapped_column(SmallInteger)
    floor: Mapped[int] = mapped_column(SmallInteger)

    house: Mapped["House"] = relationship(
        back_populates="apartments"
    )

    user_links: Mapped[list["UserApartment"]] = relationship(
        "UserApartment",
        back_populates="apartment"
    )

    __table_args__ = (
        UniqueConstraint(
            "house_id",
            "number",
            name="uq_apartment_house_number"
        ),
    )


class UserApartment(Base):
    __tablename__ = "user_apartments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id"))

    user: Mapped["User"] = relationship(
        back_populates="apartment_links"
    )

    apartment: Mapped["Apartment"] = relationship(
        back_populates="user_links"
    )

    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "apartment_id",
            name="uq_user_apartment"
        ),
    )


class Issue(Base):
    __tablename__ = "issues"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_by_staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"))
    staff_request_id: Mapped[str | None] = mapped_column(String(36))
    staff_request_hash: Mapped[str | None] = mapped_column(String(64))
    reporter_name: Mapped[str | None] = mapped_column(String(200))
    reporter_phone: Mapped[str | None] = mapped_column(String(40))
    reporter_apartment: Mapped[int | None] = mapped_column(Integer)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[IssueCategory] = mapped_column(SqlEnum(IssueCategory))
    status: Mapped[IssueStatus] = mapped_column(
        SqlEnum(IssueStatus),
        server_default=IssueStatus.NEW.name
    )
    priority: Mapped[IssuePriority] = mapped_column(SqlEnum(IssuePriority))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )
    entrance: Mapped[int | None] = mapped_column(SmallInteger)
    floor: Mapped[int | None] = mapped_column(SmallInteger)
    zone: Mapped[str | None] = mapped_column(String(30))
    apartment_id: Mapped[int | None] = mapped_column(ForeignKey("apartments.id"))
    request_id: Mapped[str | None] = mapped_column(String(36))
    request_hash: Mapped[str | None] = mapped_column(String(64))
    rejected_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(String(1500))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    __table_args__ = (
        UniqueConstraint("user_id", "request_id", name="uq_issue_request"),
        UniqueConstraint("created_by_staff_id", "staff_request_id", name="uq_staff_issue_request"),
        CheckConstraint("user_id IS NOT NULL OR (created_by_staff_id IS NOT NULL AND reporter_name IS NOT NULL AND reporter_phone IS NOT NULL)", name="ck_issue_reporter"),
    )

    user: Mapped["User | None"] = relationship(
        back_populates="issues"
    )

    house: Mapped["House"] = relationship(
        back_populates="issues"
    )

    photos: Mapped[list["IssuePhoto"]] = relationship(
        back_populates="issue"
    )


class IssuePhoto(Base):
    __tablename__ = "issue_photos"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), index=True)
    file_path: Mapped[str] = mapped_column(String(500))

    issue: Mapped["Issue"] = relationship(
        back_populates="photos"
    )


class IssueEvent(Base):
    __tablename__ = "issue_events"
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), index=True)
    status: Mapped[str] = mapped_column(String(30))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ApartmentMessage(Base):
    __tablename__ = "apartment_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    sender_id: Mapped[int] = mapped_column(ForeignKey("apartments.id"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("apartments.id"), index=True)
    text: Mapped[str] = mapped_column(Text)
    request_id: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("user_id", "request_id", name="uq_message_request"),)


class UtilityAccount(Base):
    __tablename__ = "utility_accounts"
    id: Mapped[int] = mapped_column(primary_key=True)
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id"), unique=True)
    number: Mapped[str] = mapped_column(String(100))
    area: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    residents: Mapped[int] = mapped_column(SmallInteger)
    reading_period: Mapped[str] = mapped_column(String(7))
    reading_open: Mapped[date] = mapped_column(Date)
    reading_close: Mapped[date] = mapped_column(Date)


class Invoice(Base):
    __tablename__ = "invoices"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("utility_accounts.id"), index=True)
    number: Mapped[str] = mapped_column(String(100))
    period: Mapped[str] = mapped_column(String(7))
    due: Mapped[date] = mapped_column(Date)
    charges: Mapped[list[dict]] = mapped_column(JSON)
    __table_args__ = (UniqueConstraint("account_id", "period", name="uq_invoice_period"),)


class Meter(Base):
    __tablename__ = "meters"
    id: Mapped[int] = mapped_column(primary_key=True)
    account_id: Mapped[int] = mapped_column(ForeignKey("utility_accounts.id"), index=True)
    kind: Mapped[str] = mapped_column(String(20))
    serial: Mapped[str] = mapped_column(String(100))
    previous: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    __table_args__ = (UniqueConstraint("account_id", "serial", name="uq_meter_serial"),)


class MeterReading(Base):
    __tablename__ = "meter_readings"
    id: Mapped[int] = mapped_column(primary_key=True)
    meter_id: Mapped[int] = mapped_column(ForeignKey("meters.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    period: Mapped[str] = mapped_column(String(7))
    value: Mapped[Decimal] = mapped_column(Numeric(12, 3))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (UniqueConstraint("meter_id", "period", name="uq_reading_period"),)


class HouseCamera(Base):
    __tablename__ = "house_cameras"
    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(20))
    note: Mapped[str] = mapped_column(Text)
    preview_url: Mapped[str | None] = mapped_column(String(2000))
    source_config: Mapped[str | None] = mapped_column(Text)
    source_type: Mapped[str] = mapped_column(String(20), default="snapshot", server_default="snapshot")
    captured_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    owner_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"))
    created_by_staff_id: Mapped[int | None] = mapped_column(
        ForeignKey("staff_users.id", ondelete="SET NULL")
    )
    visibility: Mapped[str] = mapped_column(String(20), default="public", server_default="public")
    moderation_status: Mapped[str] = mapped_column(
        String(20), default="approved", server_default="approved"
    )
    moderation_reason: Mapped[str | None] = mapped_column(String(1000))
    reviewed_by: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id", ondelete="SET NULL"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    entrance: Mapped[int | None] = mapped_column(SmallInteger)
    floor: Mapped[int | None] = mapped_column(SmallInteger)
    zone: Mapped[str | None] = mapped_column(String(20))
    apartment_id: Mapped[int | None] = mapped_column(ForeignKey("apartments.id"))
    request_id: Mapped[str | None] = mapped_column(String(36))
    __table_args__ = (
        UniqueConstraint("owner_id", "request_id", name="uq_camera_request"),
        UniqueConstraint("created_by_staff_id", "request_id", name="uq_staff_camera_request"),
        CheckConstraint("visibility IN ('private', 'public')", name="ck_camera_visibility"),
        CheckConstraint(
            "moderation_status IN ('pending', 'approved', 'rejected')", name="ck_camera_moderation"
        ),
    )


class HouseWork(Base):
    __tablename__ = "house_works"
    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), index=True)
    title: Mapped[str] = mapped_column(String(300))
    starts_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    location: Mapped[str] = mapped_column(String(300))


class MessageNotification(Base):
    __tablename__ = "message_notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    message_id: Mapped[int] = mapped_column(ForeignKey("apartment_messages.id"))
    max_user_id: Mapped[int] = mapped_column(BigInteger)
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    available_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    suppressed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("message_id", "max_user_id", name="uq_message_notification"),)


class StaffUser(Base):
    __tablename__ = "staff_users"
    id: Mapped[int] = mapped_column(primary_key=True)
    login: Mapped[str] = mapped_column(String(80), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    password_hash: Mapped[str] = mapped_column(String(300))
    active: Mapped[bool] = mapped_column(Boolean, default=True, server_default=true())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class StaffHouse(Base):
    __tablename__ = "staff_houses"
    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_users.id"), index=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"))
    __table_args__ = (UniqueConstraint("staff_id", "house_id", name="uq_staff_house"),)


class StaffSession(Base):
    __tablename__ = "staff_sessions"
    id: Mapped[int] = mapped_column(primary_key=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class StaffLoginThrottle(Base):
    __tablename__ = "staff_login_throttle"
    id: Mapped[int] = mapped_column(primary_key=True)
    key_hash: Mapped[str] = mapped_column(String(64), unique=True)
    attempts: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)


class IssueMessage(Base):
    __tablename__ = "issue_messages"
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), index=True)
    staff_id: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    text: Mapped[str] = mapped_column(Text)
    request_id: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    __table_args__ = (
        UniqueConstraint("issue_id", "request_id", name="uq_issue_message_request"),
        CheckConstraint(
            "(staff_id IS NOT NULL AND user_id IS NULL) OR "
            "(staff_id IS NULL AND user_id IS NOT NULL)", name="ck_issue_message_sender"
        ),
    )


class ChatPhoto(Base):
    """Private attachment belonging to exactly one chat message."""
    __tablename__ = "chat_photos"
    id: Mapped[int] = mapped_column(primary_key=True)
    apartment_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("apartment_messages.id", ondelete="CASCADE"), index=True
    )
    issue_message_id: Mapped[int | None] = mapped_column(
        ForeignKey("issue_messages.id", ondelete="CASCADE"), index=True
    )
    file_path: Mapped[str] = mapped_column(String(200), unique=True)
    content_hash: Mapped[str] = mapped_column(String(64))
    __table_args__ = (CheckConstraint(
        "(apartment_message_id IS NOT NULL AND issue_message_id IS NULL) OR "
        "(apartment_message_id IS NULL AND issue_message_id IS NOT NULL)",
        name="ck_chat_photo_message",
    ),)


class StaffNotification(Base):
    __tablename__ = "staff_notifications"
    id: Mapped[int] = mapped_column(primary_key=True)
    issue_id: Mapped[int] = mapped_column(ForeignKey("issues.id"), index=True)
    staff_id: Mapped[int] = mapped_column(ForeignKey("staff_users.id"))
    max_user_id: Mapped[int | None] = mapped_column(BigInteger)
    kind: Mapped[str] = mapped_column(String(20))
    status: Mapped[str | None] = mapped_column(String(30))
    message_id: Mapped[int | None] = mapped_column(ForeignKey("issue_messages.id"))
    text: Mapped[str] = mapped_column(Text)
    request_id: Mapped[str] = mapped_column(String(36))
    request_hash: Mapped[str] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    available_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    lease_token: Mapped[str | None] = mapped_column(String(36))
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    __table_args__ = (UniqueConstraint("staff_id", "request_id", name="uq_staff_action_request"),)

    suppressed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class MiniAppPresence(Base):
    __tablename__ = "mini_app_presence"
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(36), primary_key=True)
    sequence: Mapped[int] = mapped_column(Integer)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    issue_id: Mapped[int | None] = mapped_column(
        ForeignKey("issues.id", name="fk_mini_app_presence_issue", ondelete="CASCADE")
    )


class ManagementCompany(Base):
    __tablename__ = "management_companies"
    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(200), unique=True)


class CompanyHouse(Base):
    __tablename__ = "company_houses"
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), primary_key=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("management_companies.id"), index=True)


class HouseContact(Base):
    __tablename__ = "house_contacts"
    id: Mapped[int] = mapped_column(primary_key=True)
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"), index=True)
    position: Mapped[int] = mapped_column(SmallInteger)
    label: Mapped[str] = mapped_column(String(100))
    kind: Mapped[str] = mapped_column(String(20))
    value: Mapped[str] = mapped_column(String(300))
    note: Mapped[str] = mapped_column(String(200), default="", server_default="")
    __table_args__ = (
        CheckConstraint(
            "kind IN ('phone', 'email', 'address', 'website', 'schedule')", name="ck_contact_kind"
        ),
        UniqueConstraint("house_id", "position", name="uq_house_contact_position"),
    )


class RegistrationRequest(Base):
    __tablename__ = "registration_requests"
    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    company_id: Mapped[int] = mapped_column(ForeignKey("management_companies.id"))
    apartment_id: Mapped[int] = mapped_column(ForeignKey("apartments.id"))
    full_name: Mapped[str] = mapped_column(String(200))
    source: Mapped[str] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), default="pending")
    auto_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("staff_users.id"))
    __table_args__ = (
        CheckConstraint("status IN ('pending', 'approved', 'rejected')", name="ck_registration_status"),
    )
