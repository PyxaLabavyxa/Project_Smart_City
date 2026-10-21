"""Attribute public cameras added by staff and protect creation retries."""

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("house_cameras") as batch:
        batch.add_column(sa.Column("created_by_staff_id", sa.Integer(), nullable=True))
        batch.create_foreign_key(
            "fk_camera_staff", "staff_users", ["created_by_staff_id"], ["id"], ondelete="SET NULL"
        )
        batch.create_unique_constraint(
            "uq_staff_camera_request", ["created_by_staff_id", "request_id"]
        )


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM house_cameras WHERE created_by_staff_id IS NOT NULL")
    ):
        raise RuntimeError("Keep staff camera attribution while staff-created cameras exist")
    with op.batch_alter_table("house_cameras") as batch:
        batch.drop_constraint("uq_staff_camera_request", type_="unique")
        batch.drop_constraint("fk_camera_staff", type_="foreignkey")
        batch.drop_column("created_by_staff_id")
