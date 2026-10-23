"""Keep resident links separately from MAX group connection credentials."""

import sqlalchemy as sa
from alembic import op

revision = "0025"
down_revision = "0024"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("house_chats", sa.Column("join_url", sa.String(1024), nullable=True))
    op.add_column("house_chats", sa.Column("platform_link", sa.String(1024), nullable=True))
    op.add_column(
        "house_chats", sa.Column("link_checked_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade():
    op.drop_column("house_chats", "link_checked_at")
    op.drop_column("house_chats", "platform_link")
    op.drop_column("house_chats", "join_url")
