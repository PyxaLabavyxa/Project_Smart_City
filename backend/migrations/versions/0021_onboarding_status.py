"""Persist resident onboarding state without changing existing user data."""

import sqlalchemy as sa
from alembic import op

revision = "0021"
down_revision = "0020"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("users") as batch:
        batch.add_column(
            sa.Column(
                "onboarding_status", sa.String(16), nullable=False, server_default="not_started"
            )
        )
        batch.create_check_constraint(
            "ck_user_onboarding_status",
            "onboarding_status IN ('not_started', 'completed', 'skipped')",
        )


def downgrade():
    with op.batch_alter_table("users") as batch:
        batch.drop_constraint("ck_user_onboarding_status", type_="check")
        batch.drop_column("onboarding_status")
