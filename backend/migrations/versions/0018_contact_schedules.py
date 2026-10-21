"""Allow office and resident reception schedules alongside house contacts."""

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table("house_contacts") as batch:
        batch.drop_constraint("ck_contact_kind", type_="check")
        batch.create_check_constraint(
            "ck_contact_kind", "kind IN ('phone', 'email', 'address', 'website', 'schedule')"
        )


def downgrade():
    if op.get_bind().scalar(
        sa.text("SELECT count(*) FROM house_contacts WHERE kind = 'schedule'")
    ):
        raise RuntimeError("Keep saved schedules before downgrading house contacts")
    with op.batch_alter_table("house_contacts") as batch:
        batch.drop_constraint("ck_contact_kind", type_="check")
        batch.create_check_constraint(
            "ck_contact_kind", "kind IN ('phone', 'email', 'address', 'website')"
        )
