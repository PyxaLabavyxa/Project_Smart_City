import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade():
    op.add_column(
        "house_cameras", sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True)
    )


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM house_cameras WHERE deleted_at IS NOT NULL")
    ):
        raise RuntimeError("Archive deleted cameras before downgrading their deletion schema")
    with op.batch_alter_table("house_cameras") as batch:
        batch.drop_column("deleted_at")
