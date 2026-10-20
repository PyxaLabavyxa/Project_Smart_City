"""Add scoped personal announcements and track established bot dialogs."""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "users",
        sa.Column("bot_dialog_started", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    # Historical bot registration and confirmed private delivery are evidence of a dialog.
    op.execute(
        sa.text("""
        UPDATE users SET bot_dialog_started = true WHERE
          id IN (SELECT user_id FROM registration_requests WHERE source = 'bot') OR
          max_user_id IN (SELECT max_user_id FROM message_notifications
                         WHERE sent_at IS NOT NULL) OR
          max_user_id IN (SELECT max_user_id FROM staff_notifications WHERE sent_at IS NOT NULL)
    """)
    )
    for name, default in [("house_ids", "[]"), ("channels", '["groups"]'), ("resident_ids", "[]")]:
        op.add_column(
            "announcements", sa.Column(name, sa.JSON(), nullable=False, server_default=default)
        )
    op.add_column(
        "announcements",
        sa.Column("audience", sa.String(20), nullable=False, server_default="houses"),
    )
    op.add_column(
        "announcements",
        sa.Column("excluded_count", sa.Integer(), nullable=False, server_default="0"),
    )
    rows = (
        op.get_bind()
        .execute(sa.text("SELECT announcement_id, house_id FROM announcement_deliveries"))
        .all()
    )
    houses = {}
    for announcement_id, house_id in rows:
        houses.setdefault(announcement_id, set()).add(house_id)
    announcements = sa.table(
        "announcements", sa.column("id", sa.Integer()), sa.column("house_ids", sa.JSON())
    )
    for key, ids in houses.items():
        op.execute(
            announcements.update().where(announcements.c.id == key).values(house_ids=sorted(ids))
        )
    op.create_table(
        "announcement_private_deliveries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "announcement_id",
            sa.Integer(),
            sa.ForeignKey("announcements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "user_id", sa.Integer(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("message_id", sa.String(200)),
        sa.Column("attempted_at", sa.DateTime(timezone=True)),
        sa.Column("sent_at", sa.DateTime(timezone=True)),
        sa.Column("error", sa.String(300), nullable=False, server_default=""),
        sa.UniqueConstraint("announcement_id", "user_id", name="uq_announcement_resident"),
        sa.CheckConstraint(
            "status IN ('draft','pending','sending','sent','failed','uncertain','cancelled')",
            name="ck_announcement_private_delivery",
        ),
    )
    for column in ("announcement_id", "user_id", "status"):
        op.create_index(
            "ix_announcement_private_deliveries_" + column,
            "announcement_private_deliveries",
            [column],
        )


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM announcement_private_deliveries")):
        raise RuntimeError("Archive private announcement history before downgrading")
    op.drop_table("announcement_private_deliveries")
    with op.batch_alter_table("announcements") as batch:
        for column in ("excluded_count", "audience", "resident_ids", "channels", "house_ids"):
            batch.drop_column(column)
    with op.batch_alter_table("users") as batch:
        batch.drop_column("bot_dialog_started")
