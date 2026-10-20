"""House chat connections and staff-authored announcements."""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "house_chats",
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id"), primary_key=True),
        sa.Column("chat_id", sa.BigInteger(), unique=True),
        sa.Column("title", sa.String(200), nullable=False, server_default=""),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("code_hash", sa.String(64), unique=True),
        sa.Column("code_staff_id", sa.Integer(), sa.ForeignKey("staff_users.id")),
        sa.Column("code_expires_at", sa.DateTime(timezone=True)),
        sa.Column("connected_by", sa.BigInteger()),
        sa.Column("checked_at", sa.DateTime(timezone=True)),
        sa.Column("menu_message_id", sa.String(200)),
        sa.Column("menu_status", sa.String(20), nullable=False),
        sa.Column("menu_attempted_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(300), nullable=False, server_default=""),
        sa.CheckConstraint(
            "status IN ('disconnected','connected','attention')", name="ck_house_chat_status"
        ),
        sa.CheckConstraint(
            "menu_status IN ('none','pending','sending','ready','failed','uncertain')",
            name="ck_house_chat_menu",
        ),
    )
    op.create_table(
        "announcements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff_users.id"), nullable=False),
        sa.Column("topic", sa.String(20), nullable=False),
        sa.Column("title", sa.String(150), nullable=False),
        sa.Column("text", sa.String(3000), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.CheckConstraint("status IN ('draft','queued')", name="ck_announcement_status"),
        sa.CheckConstraint(
            "topic IN ('outage','works','meeting','other')", name="ck_announcement_topic"
        ),
    )
    op.create_index("ix_announcements_staff_id", "announcements", ["staff_id"])
    op.create_table(
        "announcement_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "announcement_id",
            sa.Integer(),
            sa.ForeignKey("announcements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id"), nullable=False),
        sa.Column("chat_id", sa.BigInteger()),
        sa.Column("chat_revision", sa.Integer()),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("message_id", sa.String(200)),
        sa.Column("attempted_at", sa.DateTime(timezone=True)),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(300), nullable=False, server_default=""),
        sa.UniqueConstraint("announcement_id", "house_id", name="uq_announcement_house"),
        sa.CheckConstraint(
            "status IN ('draft','pending','sending','sent','failed','uncertain','cancelled')",
            name="ck_announcement_delivery",
        ),
    )
    op.create_index(
        "ix_announcement_deliveries_announcement_id", "announcement_deliveries", ["announcement_id"]
    )


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM announcements")):
        raise RuntimeError("Archive announcements before removing their delivery history")
    op.drop_table("announcement_deliveries")
    op.drop_table("announcements")
    op.drop_table("house_chats")
