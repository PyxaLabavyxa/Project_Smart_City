from datetime import datetime

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

from app.database.enums import IssueCategory, IssuePriority, IssueStatus


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    max_user_id: Mapped[int] = mapped_column(BigInteger, unique=True)
    name: Mapped[str] = mapped_column(String(200))
    phone_number: Mapped[int | None] = mapped_column(Integer, unique=True, nullable=True)

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
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    house_id: Mapped[int] = mapped_column(ForeignKey("houses.id"))
    title: Mapped[str] = mapped_column(String(300))
    description: Mapped[str] = mapped_column(Text)
    category: Mapped[IssueCategory] = mapped_column(SqlEnum(IssueCategory))
    status: Mapped[IssueStatus] = mapped_column(
        SqlEnum(IssueStatus),
        server_default=IssueStatus.NEW.value
    )
    priority: Mapped[IssuePriority] = mapped_column(SqlEnum(IssuePriority))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now()
    )

    user: Mapped["User"] = relationship(
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
