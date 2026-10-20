import sqlalchemy as sa
from alembic import op

revision = "0011"
down_revision = "0010"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("house_cameras") as batch:
        batch.add_column(sa.Column("owner_id", sa.Integer(), nullable=True))
        batch.add_column(
            sa.Column("visibility", sa.String(20), nullable=False, server_default="public")
        )
        batch.add_column(
            sa.Column("moderation_status", sa.String(20), nullable=False, server_default="approved")
        )
        batch.add_column(sa.Column("moderation_reason", sa.String(1000), nullable=True))
        batch.add_column(sa.Column("reviewed_by", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True))
        batch.add_column(sa.Column("entrance", sa.SmallInteger(), nullable=True))
        batch.add_column(sa.Column("floor", sa.SmallInteger(), nullable=True))
        batch.add_column(sa.Column("zone", sa.String(20), nullable=True))
        batch.add_column(sa.Column("apartment_id", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("request_id", sa.String(36), nullable=True))
        batch.create_foreign_key(
            "fk_camera_owner", "users", ["owner_id"], ["id"], ondelete="CASCADE"
        )
        batch.create_foreign_key(
            "fk_camera_reviewer", "staff_users", ["reviewed_by"], ["id"], ondelete="SET NULL"
        )
        batch.create_foreign_key("fk_camera_apartment", "apartments", ["apartment_id"], ["id"])
        batch.create_unique_constraint("uq_camera_request", ["owner_id", "request_id"])
        batch.create_check_constraint("ck_camera_visibility", "visibility IN ('private', 'public')")
        batch.create_check_constraint(
            "ck_camera_moderation", "moderation_status IN ('pending', 'approved', 'rejected')"
        )
    cameras = sa.table(
        "house_cameras",
        sa.column("name"),
        sa.column("entrance"),
        sa.column("floor"),
        sa.column("zone"),
    )
    for name, entrance, zone in (
        ("Подъезд 1", 1, "entrance"),
        ("Подъезд 2", 2, "entrance"),
        ("Двор", 1, "courtyard"),
    ):
        op.execute(
            cameras.update()
            .where(cameras.c.name == name)
            .values(entrance=entrance, floor=1, zone=zone)
        )


def downgrade():
    # Dropping ownership would publish private cameras to old application versions.
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM house_cameras WHERE owner_id IS NOT NULL")
    ):
        raise RuntimeError("Archive resident cameras before downgrading their privacy schema")
    with op.batch_alter_table("house_cameras") as batch:
        for name in ("ck_camera_moderation", "ck_camera_visibility"):
            batch.drop_constraint(name, type_="check")
        batch.drop_constraint("uq_camera_request", type_="unique")
        for name in ("fk_camera_apartment", "fk_camera_reviewer", "fk_camera_owner"):
            batch.drop_constraint(name, type_="foreignkey")
        for name in (
            "request_id",
            "apartment_id",
            "zone",
            "floor",
            "entrance",
            "reviewed_at",
            "reviewed_by",
            "moderation_reason",
            "moderation_status",
            "visibility",
            "owner_id",
        ):
            batch.drop_column(name)
