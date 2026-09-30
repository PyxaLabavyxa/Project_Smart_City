import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("issues", sa.Column("rejected_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("issues", sa.Column("rejection_reason", sa.String(1500), nullable=True))


def downgrade():
    op.drop_column("issues", "rejection_reason")
    op.drop_column("issues", "rejected_at")
