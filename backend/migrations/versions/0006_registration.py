"""Shared resident onboarding and management-company applications."""

import sqlalchemy as sa
from alembic import op

revision = "0006"
down_revision = "0005"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "management_companies",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(200), nullable=False, unique=True),
    )
    op.create_table(
        "company_houses",
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id"), primary_key=True),
        sa.Column(
            "company_id", sa.Integer(), sa.ForeignKey("management_companies.id"), nullable=False
        ),
    )
    op.create_index("ix_company_houses_company_id", "company_houses", ["company_id"])
    op.create_table(
        "registration_requests",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column(
            "company_id", sa.Integer(), sa.ForeignKey("management_companies.id"), nullable=False
        ),
        sa.Column("apartment_id", sa.Integer(), sa.ForeignKey("apartments.id"), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("source", sa.String(20), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("auto_approved", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column("decided_at", sa.DateTime(timezone=True)),
        sa.Column("decided_by", sa.Integer(), sa.ForeignKey("staff_users.id")),
        sa.CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')", name="ck_registration_status"
        ),
    )
    op.create_index("ix_registration_requests_user_id", "registration_requests", ["user_id"])


def downgrade():
    op.drop_table("registration_requests")
    op.drop_table("company_houses")
    op.drop_table("management_companies")
