import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("mini_app_presence") as batch:
        batch.add_column(sa.Column("issue_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_mini_app_presence_issue", "issues", ["issue_id"], ["id"], ondelete="CASCADE"
        )
    op.add_column(
        "staff_notifications", sa.Column("suppressed_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade():
    op.drop_column("staff_notifications", "suppressed_at")
    with op.batch_alter_table("mini_app_presence") as batch:
        batch.drop_constraint("fk_mini_app_presence_issue", type_="foreignkey")
        batch.drop_column("issue_id")
