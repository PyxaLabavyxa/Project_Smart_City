"""0002: Resident API storage."""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "house_cameras",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("house_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("preview_url", sa.String(length=2000), nullable=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["house_id"],
            ["houses.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("house_cameras", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_house_cameras_house_id"), ["house_id"], unique=False)

    op.create_table(
        "house_works",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("house_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("location", sa.String(length=300), nullable=False),
        sa.ForeignKeyConstraint(
            ["house_id"],
            ["houses.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("house_works", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_house_works_house_id"), ["house_id"], unique=False)

    op.create_table(
        "apartment_messages",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("sender_id", sa.Integer(), nullable=False),
        sa.Column("recipient_id", sa.Integer(), nullable=False),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("request_id", sa.String(length=36), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["recipient_id"],
            ["apartments.id"],
        ),
        sa.ForeignKeyConstraint(
            ["sender_id"],
            ["apartments.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "request_id", name="uq_message_request"),
    )
    with op.batch_alter_table("apartment_messages", schema=None) as batch_op:
        batch_op.create_index(
            batch_op.f("ix_apartment_messages_recipient_id"), ["recipient_id"], unique=False
        )
        batch_op.create_index(
            batch_op.f("ix_apartment_messages_sender_id"), ["sender_id"], unique=False
        )

    op.create_table(
        "utility_accounts",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=100), nullable=False),
        sa.Column("area", sa.Numeric(precision=10, scale=2), nullable=False),
        sa.Column("residents", sa.SmallInteger(), nullable=False),
        sa.Column("reading_period", sa.String(length=7), nullable=False),
        sa.Column("reading_open", sa.Date(), nullable=False),
        sa.Column("reading_close", sa.Date(), nullable=False),
        sa.ForeignKeyConstraint(
            ["apartment_id"],
            ["apartments.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("apartment_id"),
    )
    op.create_table(
        "invoices",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.String(length=100), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("due", sa.Date(), nullable=False),
        sa.Column("charges", sa.JSON(), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["utility_accounts.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "period", name="uq_invoice_period"),
    )
    with op.batch_alter_table("invoices", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_invoices_account_id"), ["account_id"], unique=False)

    op.create_table(
        "issue_events",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("issue_id", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(length=30), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["issue_id"],
            ["issues.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("issue_events", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_issue_events_issue_id"), ["issue_id"], unique=False)

    op.create_table(
        "meters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("account_id", sa.Integer(), nullable=False),
        sa.Column("kind", sa.String(length=20), nullable=False),
        sa.Column("serial", sa.String(length=100), nullable=False),
        sa.Column("previous", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.ForeignKeyConstraint(
            ["account_id"],
            ["utility_accounts.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("account_id", "serial", name="uq_meter_serial"),
    )
    with op.batch_alter_table("meters", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_meters_account_id"), ["account_id"], unique=False)

    op.create_table(
        "meter_readings",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("meter_id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("period", sa.String(length=7), nullable=False),
        sa.Column("value", sa.Numeric(precision=12, scale=3), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["meter_id"],
            ["meters.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("meter_id", "period", name="uq_reading_period"),
    )
    with op.batch_alter_table("issues", schema=None) as batch_op:
        batch_op.add_column(sa.Column("entrance", sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column("floor", sa.SmallInteger(), nullable=True))
        batch_op.add_column(sa.Column("zone", sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column("apartment_id", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("request_id", sa.String(length=36), nullable=True))
        batch_op.add_column(sa.Column("request_hash", sa.String(length=64), nullable=True))
        batch_op.create_unique_constraint("uq_issue_request", ["user_id", "request_id"])
        batch_op.create_foreign_key("fk_issue_apartment", "apartments", ["apartment_id"], ["id"])


def downgrade():
    with op.batch_alter_table("issues", schema=None) as batch_op:
        batch_op.drop_constraint("fk_issue_apartment", type_="foreignkey")
        batch_op.drop_constraint("uq_issue_request", type_="unique")
        batch_op.drop_column("request_hash")
        batch_op.drop_column("request_id")
        batch_op.drop_column("apartment_id")
        batch_op.drop_column("zone")
        batch_op.drop_column("floor")
        batch_op.drop_column("entrance")

    op.drop_table("meter_readings")
    with op.batch_alter_table("meters", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_meters_account_id"))

    op.drop_table("meters")
    with op.batch_alter_table("issue_events", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_issue_events_issue_id"))

    op.drop_table("issue_events")
    with op.batch_alter_table("invoices", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_invoices_account_id"))

    op.drop_table("invoices")
    op.drop_table("utility_accounts")
    with op.batch_alter_table("apartment_messages", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_apartment_messages_sender_id"))
        batch_op.drop_index(batch_op.f("ix_apartment_messages_recipient_id"))

    op.drop_table("apartment_messages")
    with op.batch_alter_table("house_works", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_house_works_house_id"))

    op.drop_table("house_works")
    with op.batch_alter_table("house_cameras", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_house_cameras_house_id"))

    op.drop_table("house_cameras")
