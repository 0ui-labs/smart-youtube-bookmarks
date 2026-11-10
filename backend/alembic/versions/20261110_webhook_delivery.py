"""Persist webhook replay digests atomically with background intents."""

import sqlalchemy as sa

from alembic import op

revision = "20261110_webhook_delivery"
down_revision = "20261110_clerk_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "webhook_deliveries",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.clock_timestamp(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.clock_timestamp(),
            nullable=False,
        ),
        sa.Column("digest", sa.String(64), nullable=False, unique=True),
    )


def downgrade() -> None:
    op.drop_table("webhook_deliveries")
