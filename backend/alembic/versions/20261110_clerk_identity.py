"""Add an explicit external identity; never claim legacy rows on login."""

import sqlalchemy as sa

from alembic import op

revision = "20261110_clerk_identity"
down_revision = "20261110_job_outbox"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("users", sa.Column("clerk_id", sa.String(255), nullable=True))
    op.create_index("ix_users_clerk_id", "users", ["clerk_id"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_clerk_id", table_name="users")
    op.drop_column("users", "clerk_id")
