"""Publish house work calendars together with announcement delivery queues."""

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("announcements", sa.Column("work", sa.JSON(), nullable=True))
    with op.batch_alter_table("house_works") as batch:
        batch.add_column(sa.Column("announcement_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_work_announcement",
            "announcements",
            ["announcement_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch.create_unique_constraint(
            "uq_work_announcement_house", ["announcement_id", "house_id"]
        )


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM announcements WHERE work IS NOT NULL")):
        raise RuntimeError("Keep planned work schedules while work announcements exist")
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM house_works WHERE announcement_id IS NOT NULL")
    ):
        raise RuntimeError("Keep planned work publication links")
    with op.batch_alter_table("house_works") as batch:
        batch.drop_constraint("uq_work_announcement_house", type_="unique")
        batch.drop_constraint("fk_work_announcement", type_="foreignkey")
        batch.drop_column("announcement_id")
    op.drop_column("announcements", "work")
