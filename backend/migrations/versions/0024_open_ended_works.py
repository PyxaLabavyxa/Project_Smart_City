"""Allow work schedules with an unknown end, preserving existing periods."""

import sqlalchemy as sa
from alembic import op

revision = "0024"
down_revision = "0023"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("house_works") as batch:
        batch.alter_column("ends_at", existing_type=sa.DateTime(timezone=True), nullable=True)


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM house_works WHERE ends_at IS NULL")):
        raise RuntimeError("Keep open-ended works until their actual end is recorded")
    notices = sa.table("announcements", sa.column("work", sa.JSON()))
    if op.get_bind().scalar(
        sa.select(sa.func.count()).select_from(notices).where(
            notices.c.work.is_not(None), notices.c.work["ends_at"].as_string().is_(None)
        )
    ):
        raise RuntimeError("Keep open-ended work schedules, including unpublished drafts")
    with op.batch_alter_table("house_works") as batch:
        batch.alter_column("ends_at", existing_type=sa.DateTime(timezone=True), nullable=False)
