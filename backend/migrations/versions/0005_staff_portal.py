import sqlalchemy as sa
from alembic import op

revision = "0005"
down_revision = "0004"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "staff_users",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("login", sa.String(80), nullable=False, unique=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(300), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
    )
    op.create_table(
        "staff_houses",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff_users.id"), nullable=False),
        sa.Column("house_id", sa.Integer(), sa.ForeignKey("houses.id"), nullable=False),
        sa.UniqueConstraint("staff_id", "house_id", name="uq_staff_house"),
    )
    op.create_index("ix_staff_houses_staff_id", "staff_houses", ["staff_id"])
    op.create_table(
        "staff_sessions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff_users.id"), nullable=False),
        sa.Column("token_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_staff_sessions_staff_id", "staff_sessions", ["staff_id"])
    op.create_index("ix_staff_sessions_expires_at", "staff_sessions", ["expires_at"])
    op.create_table(
        "staff_login_throttle",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key_hash", sa.String(64), nullable=False, unique=True),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_staff_login_throttle_expires_at", "staff_login_throttle", ["expires_at"])
    op.create_table(
        "issue_messages",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("issue_id", sa.Integer(), sa.ForeignKey("issues.id"), nullable=False),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff_users.id"), nullable=True),
        sa.Column("user_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("request_id", sa.String(200), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.UniqueConstraint("issue_id", "request_id", name="uq_issue_message_request"),
        sa.CheckConstraint(
            "(staff_id IS NOT NULL AND user_id IS NULL) OR "
            "(staff_id IS NULL AND user_id IS NOT NULL)",
            name="ck_issue_message_sender",
        ),
    )
    op.create_index("ix_issue_messages_issue_id", "issue_messages", ["issue_id"])
    op.create_table(
        "staff_notifications",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("issue_id", sa.Integer(), sa.ForeignKey("issues.id"), nullable=False),
        sa.Column("staff_id", sa.Integer(), sa.ForeignKey("staff_users.id"), nullable=False),
        sa.Column("max_user_id", sa.BigInteger(), nullable=False),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("status", sa.String(30), nullable=True),
        sa.Column("message_id", sa.Integer(), sa.ForeignKey("issue_messages.id"), nullable=True),
        sa.Column("text", sa.Text(), nullable=False),
        sa.Column("request_id", sa.String(36), nullable=False),
        sa.Column("request_hash", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("attempts", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "available_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()
        ),
        sa.Column("lease_token", sa.String(36), nullable=True),
        sa.Column("sent_at", sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint("staff_id", "request_id", name="uq_staff_action_request"),
    )
    op.create_index("ix_staff_notifications_issue_id", "staff_notifications", ["issue_id"])
    op.create_index("ix_staff_notifications_available_at", "staff_notifications", ["available_at"])


def downgrade():
    for table in (
        "staff_notifications",
        "issue_messages",
        "staff_login_throttle",
        "staff_sessions",
        "staff_houses",
        "staff_users",
    ):
        op.drop_table(table)
