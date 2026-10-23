"""Add accepted and assigned issue states without changing existing issues."""

import sqlalchemy as sa
from alembic import op

revision = "0026"
down_revision = "0025"
branch_labels = None
depends_on = None


def upgrade():
    if op.get_bind().dialect.name == "postgresql":
        op.execute("ALTER TYPE issuestatus ADD VALUE IF NOT EXISTS 'ACCEPTED' BEFORE 'IN_PROGRESS'")
        op.execute("ALTER TYPE issuestatus ADD VALUE IF NOT EXISTS 'ASSIGNED' BEFORE 'IN_PROGRESS'")


def downgrade():
    connection = op.get_bind()
    for table in ("issues", "issue_events", "staff_notifications"):
        if connection.scalar(
            sa.text(
                f"SELECT count(*) FROM {table} WHERE lower(CAST(status AS TEXT)) "
                "IN ('accepted', 'assigned')"
            )
        ):
            raise RuntimeError("Cannot remove issue states while issues or their history use them")
    if connection.dialect.name == "postgresql":
        op.execute("ALTER TABLE issues ALTER COLUMN status DROP DEFAULT")
        op.execute("ALTER TYPE issuestatus RENAME TO issuestatus_with_intake")
        op.execute("CREATE TYPE issuestatus AS ENUM ('NEW', 'IN_PROGRESS', 'RESOLVED')")
        op.execute(
            "ALTER TABLE issues ALTER COLUMN status TYPE issuestatus "
            "USING status::text::issuestatus"
        )
        op.execute("ALTER TABLE issues ALTER COLUMN status SET DEFAULT 'NEW'")
        op.execute("DROP TYPE issuestatus_with_intake")
