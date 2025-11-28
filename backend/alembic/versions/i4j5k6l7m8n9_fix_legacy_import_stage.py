"""fix_legacy_import_stage

Revision ID: i4j5k6l7m8n9
Revises: h3i4j5k6l7m8
Create Date: 2025-11-28 12:00:00.000000

Data Migration: Fix legacy videos that have processing_status='completed'
but import_stage='created' (set by previous migration's server_default).

These videos were imported BEFORE the two-phase import feature was implemented,
so they should have import_stage='complete' (not 'created').
"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = 'i4j5k6l7m8n9'
down_revision: Union[str, None] = 'h3i4j5k6l7m8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Fix legacy videos: If processing_status is 'completed' but import_stage
    # is still 'created' (from migration default), these are old videos that
    # were fully imported before the two-phase import feature existed.
    # Mark them as 'complete' so they display correctly in the UI.
    op.execute("""
        UPDATE videos
        SET import_stage = 'complete', import_progress = 100
        WHERE processing_status = 'completed'
          AND import_stage = 'created'
    """)


def downgrade() -> None:
    # Revert to 'created' (the original migration default)
    # Note: This loses the distinction between "legacy complete" and "new created"
    op.execute("""
        UPDATE videos
        SET import_stage = 'created', import_progress = 0
        WHERE processing_status = 'completed'
          AND import_stage = 'complete'
    """)
