"""Private photographs in neighbor and management chats."""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "chat_photos",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "apartment_message_id",
            sa.Integer(),
            sa.ForeignKey("apartment_messages.id", ondelete="CASCADE"),
        ),
        sa.Column(
            "issue_message_id", sa.Integer(), sa.ForeignKey("issue_messages.id", ondelete="CASCADE")
        ),
        sa.Column("file_path", sa.String(200), nullable=False, unique=True),
        sa.Column("content_hash", sa.String(64), nullable=False),
        sa.CheckConstraint(
            "(apartment_message_id IS NOT NULL AND issue_message_id IS NULL) OR "
            "(apartment_message_id IS NULL AND issue_message_id IS NOT NULL)",
            name="ck_chat_photo_message",
        ),
    )
    op.create_index("ix_chat_photos_apartment_message_id", "chat_photos", ["apartment_message_id"])
    op.create_index("ix_chat_photos_issue_message_id", "chat_photos", ["issue_message_id"])


def downgrade():
    op.drop_table("chat_photos")
