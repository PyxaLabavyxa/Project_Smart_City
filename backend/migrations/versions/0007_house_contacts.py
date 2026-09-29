import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "house_contacts",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id"), nullable=False),
        sa.Column("position", sa.SmallInteger(), nullable=False),
        sa.Column("label", sa.String(100), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("value", sa.String(300), nullable=False),
        sa.Column("note", sa.String(200), nullable=False, server_default=""),
        sa.CheckConstraint(
            "kind IN ('phone', 'email', 'address', 'website')", name="ck_contact_kind"
        ),
        sa.UniqueConstraint("house_id", "position", name="uq_house_contact_position"),
    )
    op.create_index("ix_house_contacts_house_id", "house_contacts", ["house_id"])


def downgrade():
    op.drop_table("house_contacts")
