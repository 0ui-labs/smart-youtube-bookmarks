"""add_subscriptions

Revision ID: 898750768ddd
Revises: i4j5k6l7m8n9
Create Date: 2025-12-04 19:11:23.748363

"""

from collections.abc import Sequence

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "898750768ddd"
down_revision: str | None = "i4j5k6l7m8n9"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # Create subscriptions table
    op.create_table(
        "subscriptions",
        sa.Column("user_id", sa.UUID(), nullable=False),
        sa.Column("list_id", sa.UUID(), nullable=False),
        sa.Column("name", sa.String(length=255), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="true"),
        sa.Column("channel_ids", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column("keywords", postgresql.ARRAY(sa.Text()), nullable=True),
        sa.Column(
            "filters",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column(
            "poll_interval",
            sa.String(length=20),
            nullable=False,
            server_default="'daily'",
        ),
        sa.Column("last_polled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("next_poll_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "pubsub_callback_ids",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default="{}",
        ),
        sa.Column("pubsub_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("match_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["list_id"], ["bookmarks_lists.id"], ondelete="RESTRICT"
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_subscriptions_active_poll",
        "subscriptions",
        ["is_active", "next_poll_at"],
        unique=False,
        postgresql_where=sa.text("is_active = true"),
    )
    op.create_index(
        op.f("ix_subscriptions_list_id"), "subscriptions", ["list_id"], unique=False
    )
    op.create_index(
        op.f("ix_subscriptions_user_id"), "subscriptions", ["user_id"], unique=False
    )

    # Create subscription_matches table
    op.create_table(
        "subscription_matches",
        sa.Column("subscription_id", sa.UUID(), nullable=False),
        sa.Column("video_id", sa.UUID(), nullable=False),
        sa.Column(
            "matched_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("clock_timestamp()"),
        ),
        sa.Column("source", sa.String(length=50), nullable=True),
        sa.Column("id", sa.UUID(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("clock_timestamp()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["subscription_id"], ["subscriptions.id"], ondelete="CASCADE"
        ),
        sa.ForeignKeyConstraint(["video_id"], ["videos.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "idx_subscription_matches_unique",
        "subscription_matches",
        ["subscription_id", "video_id"],
        unique=True,
    )
    op.create_index(
        op.f("ix_subscription_matches_subscription_id"),
        "subscription_matches",
        ["subscription_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_subscription_matches_video_id"),
        "subscription_matches",
        ["video_id"],
        unique=False,
    )


def downgrade() -> None:
    # Drop subscription_matches table
    op.drop_index(
        op.f("ix_subscription_matches_video_id"), table_name="subscription_matches"
    )
    op.drop_index(
        op.f("ix_subscription_matches_subscription_id"),
        table_name="subscription_matches",
    )
    op.drop_index("idx_subscription_matches_unique", table_name="subscription_matches")
    op.drop_table("subscription_matches")

    # Drop subscriptions table
    op.drop_index(op.f("ix_subscriptions_user_id"), table_name="subscriptions")
    op.drop_index(op.f("ix_subscriptions_list_id"), table_name="subscriptions")
    op.drop_index(
        "idx_subscriptions_active_poll",
        table_name="subscriptions",
        postgresql_where=sa.text("is_active = true"),
    )
    op.drop_table("subscriptions")
