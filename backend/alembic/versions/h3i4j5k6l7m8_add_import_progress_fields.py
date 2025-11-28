"""add_import_progress_fields

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2025-11-27 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add import_progress field (0-100 percentage)
    op.add_column('videos', sa.Column(
        'import_progress',
        sa.Integer(),
        nullable=False,
        server_default='0',
        comment='Import progress percentage (0-100)'
    ))
    # Add import_stage field (created, metadata, captions, chapters, complete, error)
    op.add_column('videos', sa.Column(
        'import_stage',
        sa.String(length=20),
        nullable=False,
        server_default='created',
        comment='Current import stage'
    ))
    # Add index for filtering by import stage
    op.create_index('idx_videos_import_stage', 'videos', ['import_stage'])


def downgrade() -> None:
    op.drop_index('idx_videos_import_stage', 'videos')
    op.drop_column('videos', 'import_stage')
    op.drop_column('videos', 'import_progress')
