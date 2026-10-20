"""Encrypted server-side camera sources; legacy demo and HTTPS stills are retained."""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column("house_cameras", sa.Column("source_config", sa.Text(), nullable=True))
    op.add_column(
        "house_cameras",
        sa.Column("source_type", sa.String(20), nullable=False, server_default="snapshot"),
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM house_cameras WHERE source_config IS NOT NULL")
    ):
        raise RuntimeError(
            "Cannot remove camera source schema while encrypted connections exist; "
            "export or remove these cameras first"
        )
    op.drop_column("house_cameras", "source_type")
    op.drop_column("house_cameras", "source_config")
