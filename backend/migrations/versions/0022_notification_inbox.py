"""Keep resident and staff inbox events independently of MAX delivery."""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("staff_notifications", sa.Column("suppression_reason", sa.String(20)))
    op.create_table(
        "inbox_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE")),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff_users.id", ondelete="CASCADE")),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id", ondelete="SET NULL")),
        sa.Column(
            "apartment_id", sa.Integer(), sa.ForeignKey("apartments.id", ondelete="SET NULL")
        ),
        sa.Column("event_key", sa.String(200), nullable=False),
        sa.Column("kind", sa.String(30), nullable=False),
        sa.Column("title", sa.String(240), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column("href", sa.String(300)),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("read_at", sa.DateTime(timezone=True)),
        sa.UniqueConstraint("user_id", "event_key", name="uq_inbox_user_event"),
        sa.UniqueConstraint("staff_id", "event_key", name="uq_inbox_staff_event"),
        sa.CheckConstraint(
            "(user_id IS NOT NULL AND staff_id IS NULL) OR "
            "(user_id IS NULL AND staff_id IS NOT NULL)",
            name="ck_inbox_recipient",
        ),
    )
    for column in ("user_id", "staff_id", "read_at"):
        op.create_index("ix_inbox_notifications_" + column, "inbox_notifications", [column])


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM inbox_notifications")):
        raise RuntimeError("Export notification history before downgrading")
    op.drop_table("inbox_notifications")
    op.drop_column("staff_notifications", "suppression_reason")
