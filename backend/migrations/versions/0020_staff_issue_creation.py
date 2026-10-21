"""Allow staff to record phone reports without creating resident accounts."""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("issues") as batch:
        batch.alter_column("user_id", existing_type=sa.Integer(), nullable=True)
        batch.add_column(sa.Column("created_by_staff_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_issue_created_by_staff", "staff_users", ["created_by_staff_id"], ["id"]
        )
        batch.add_column(sa.Column("staff_request_id", sa.String(36), nullable=True))
        batch.add_column(sa.Column("staff_request_hash", sa.String(64), nullable=True))
        batch.add_column(sa.Column("reporter_name", sa.String(200), nullable=True))
        batch.add_column(sa.Column("reporter_phone", sa.String(40), nullable=True))
        batch.add_column(sa.Column("reporter_apartment", sa.Integer(), nullable=True))
        batch.create_unique_constraint(
            "uq_staff_issue_request", ["created_by_staff_id", "staff_request_id"]
        )
        batch.create_check_constraint(
            "ck_issue_reporter",
            "user_id IS NOT NULL OR (created_by_staff_id IS NOT NULL "
            "AND reporter_name IS NOT NULL AND reporter_phone IS NOT NULL)",
        )
    with op.batch_alter_table("staff_notifications") as batch:
        batch.alter_column("max_user_id", existing_type=sa.BigInteger(), nullable=True)


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM issues WHERE created_by_staff_id IS NOT NULL")
    ):
        raise RuntimeError(
            "Export staff-created issues before downgrading; reporter data would be lost"
        )
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM staff_notifications WHERE max_user_id IS NULL")
    ):
        raise RuntimeError("Preserve manual report action history before downgrading")
    with op.batch_alter_table("staff_notifications") as batch:
        batch.alter_column("max_user_id", existing_type=sa.BigInteger(), nullable=False)
    with op.batch_alter_table("issues") as batch:
        batch.drop_constraint("ck_issue_reporter", type_="check")
        batch.drop_constraint("uq_staff_issue_request", type_="unique")
        batch.drop_constraint("fk_issue_created_by_staff", type_="foreignkey")
        for name in (
            "reporter_apartment",
            "reporter_phone",
            "reporter_name",
            "staff_request_hash",
            "staff_request_id",
            "created_by_staff_id",
        ):
            batch.drop_column(name)
        batch.alter_column("user_id", existing_type=sa.Integer(), nullable=False)
