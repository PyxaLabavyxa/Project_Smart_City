"""Keep a tombstone when a resident removes an unaccepted issue."""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("issues", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True))


def downgrade():
    if op.get_bind().scalar(sa.text("SELECT count(*) FROM issues WHERE deleted_at IS NOT NULL")):
        raise RuntimeError("Cannot downgrade: deleted issues would become visible again")
    op.drop_column("issues", "deleted_at")
