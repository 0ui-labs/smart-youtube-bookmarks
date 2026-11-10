"""add_progress_message_to_video_enrichments

Revision ID: f1a2b3c4d5e6
Revises: ae1b50a56ff5
Create Date: 2025-11-25 17:10:00.000000

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "f1a2b3c4d5e6"
down_revision: str | None = "ae1b50a56ff5"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # The original repository omitted the enrichment table's base migration.
    # Existing installations already have it; fresh databases need its explicit schema.
    if not sa.inspect(op.get_bind()).has_table("video_enrichments"):
        from sqlalchemy.dialects import postgresql

        op.create_table(
            "video_enrichments",
            sa.Column("id", sa.UUID(), primary_key=True),
            sa.Column(
                "video_id",
                sa.UUID(),
                sa.ForeignKey("videos.id", ondelete="CASCADE"),
                unique=True,
                nullable=False,
            ),
            sa.Column(
                "created_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "updated_at",
                sa.DateTime(timezone=True),
                server_default=sa.func.now(),
                nullable=False,
            ),
            sa.Column(
                "status", sa.String(20), nullable=False, server_default="pending"
            ),
            sa.Column("captions_vtt", sa.Text()),
            sa.Column("captions_language", sa.String(10)),
            sa.Column("captions_source", sa.String(30)),
            sa.Column("transcript_text", sa.Text()),
            sa.Column("chapters_vtt", sa.Text()),
            sa.Column("chapters_json", postgresql.JSONB()),
            sa.Column("chapters_source", sa.String(30)),
            sa.Column("thumbnails_vtt_url", sa.String(500)),
            sa.Column("error_message", sa.Text()),
            sa.Column("retry_count", sa.Integer(), nullable=False, server_default="0"),
            sa.Column("processed_at", sa.DateTime(timezone=True)),
        )
    # Add progress_message column to video_enrichments table
    op.add_column(
        "video_enrichments",
        sa.Column("progress_message", sa.String(length=100), nullable=True),
    )


def downgrade() -> None:
    # Remove progress_message column
    op.drop_column("video_enrichments", "progress_message")
