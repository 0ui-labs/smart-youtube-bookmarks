"""Persist durable background job intents.

Revision ID: 20261110_job_outbox
Revises: 898750768ddd
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision = "20261110_job_outbox"
down_revision = "898750768ddd"
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        "job_outbox",
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
        sa.Column("kind", sa.String(80), nullable=False),
        sa.Column("target_id", sa.String(128), nullable=False),
        sa.Column("payload_version", sa.Integer(), nullable=False),
        sa.Column("payload", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column(
            "next_attempt_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("lease_until", sa.DateTime(timezone=True)),
        sa.Column("last_error", sa.Text()),
    )
    for column in ("target_id", "status", "next_attempt_at"):
        op.create_index(f"ix_job_outbox_{column}", "job_outbox", [column])


def downgrade():
    op.drop_table("job_outbox")
