import sqlalchemy as sa
from alembic import op

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "houses",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("address", sa.String(length=300), nullable=False),
        sa.Column("entrances_count", sa.SmallInteger(), nullable=False),
        sa.Column("floors_count", sa.SmallInteger(), nullable=False),
        sa.Column("apartments_per_floor", sa.SmallInteger(), nullable=False),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "users",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("max_user_id", sa.BigInteger(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("max_user_id"),
    )
    op.create_table(
        "apartments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("house_id", sa.Integer(), nullable=False),
        sa.Column("number", sa.Integer(), nullable=False),
        sa.Column("entrance", sa.SmallInteger(), nullable=False),
        sa.Column("floor", sa.SmallInteger(), nullable=False),
        sa.ForeignKeyConstraint(
            ["house_id"],
            ["houses.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("house_id", "number", name="uq_apartment_house_number"),
    )
    op.create_table(
        "issues",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("house_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column(
            "category",
            sa.Enum(
                "WATER",
                "HEATING",
                "ELECTRICITY",
                "ELEVATOR",
                "ENTRANCE",
                "YARD",
                "GARBAGE",
                "SECURITY",
                "OTHER",
                name="issuecategory",
            ),
            nullable=False,
        ),
        sa.Column(
            "status",
            sa.Enum("NEW", "IN_PROGRESS", "RESOLVED", name="issuestatus"),
            server_default="NEW",
            nullable=False,
        ),
        sa.Column(
            "priority", sa.Enum("HIGH", "MEDIUM", "LOW", name="issuepriority"), nullable=False
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["house_id"],
            ["houses.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "issue_photos",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("issue_id", sa.Integer(), nullable=False),
        sa.Column("file_path", sa.String(length=500), nullable=False),
        sa.ForeignKeyConstraint(
            ["issue_id"],
            ["issues.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    with op.batch_alter_table("issue_photos", schema=None) as batch_op:
        batch_op.create_index(batch_op.f("ix_issue_photos_issue_id"), ["issue_id"], unique=False)

    op.create_table(
        "user_apartments",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("user_id", sa.Integer(), nullable=False),
        sa.Column("apartment_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(
            ["apartment_id"],
            ["apartments.id"],
        ),
        sa.ForeignKeyConstraint(
            ["user_id"],
            ["users.id"],
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "apartment_id", name="uq_user_apartment"),
    )


def downgrade():
    op.drop_table("user_apartments")
    with op.batch_alter_table("issue_photos", schema=None) as batch_op:
        batch_op.drop_index(batch_op.f("ix_issue_photos_issue_id"))

    op.drop_table("issue_photos")
    op.drop_table("issues")
    op.drop_table("apartments")
    op.drop_table("users")
    op.drop_table("houses")
    if op.get_bind().dialect.name == "postgresql":
        for name in ("issuecategory", "issuestatus", "issuepriority"):
            sa.Enum(name=name).drop(op.get_bind(), checkfirst=True)
