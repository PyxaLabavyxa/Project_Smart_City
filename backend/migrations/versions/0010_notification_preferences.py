import sqlalchemy as sa
from alembic import op

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None

categories = ("personal_messages", "issue_messages", "issue_statuses", "announcements")


def upgrade():
    for category in categories:
        op.add_column(
            "users",
            sa.Column("notify_" + category, sa.Boolean(), nullable=False, server_default=sa.true()),
        )


def downgrade():
    with op.batch_alter_table("users") as batch:
        for category in reversed(categories):
            batch.drop_column("notify_" + category)
