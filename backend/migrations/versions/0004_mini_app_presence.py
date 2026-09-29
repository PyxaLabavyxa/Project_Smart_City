"""Avoid bot message notifications while the recipient is using the mini-app."""

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "mini_app_presence",
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), primary_key=True),
        sa.Column("client_id", sa.String(36), primary_key=True),
        sa.Column("sequence", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_mini_app_presence_expires_at", "mini_app_presence", ["expires_at"])
    op.add_column("message_notifications", sa.Column("suppressed_at", sa.DateTime(timezone=True)))


def downgrade():
    op.drop_column("message_notifications", "suppressed_at")
    op.drop_table("mini_app_presence")
