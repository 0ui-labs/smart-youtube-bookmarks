"""add_watch_position_to_videos

Revision ID: ae1b50a56ff5
Revises: c8d2e5f7a9b1
Create Date: 2025-11-24 23:36:27.689698

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ae1b50a56ff5'
down_revision: Union[str, None] = 'c8d2e5f7a9b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add watch_position field (seconds watched, nullable for unwatched videos)
    op.add_column('videos', sa.Column(
        'watch_position',
        sa.Integer(),
        nullable=True,
        comment='Watch position in seconds'
    ))
    # Add timestamp for when position was last updated
    op.add_column('videos', sa.Column(
        'watch_position_updated_at',
        sa.DateTime(timezone=True),
        nullable=True,
        comment='Last update timestamp for watch position'
    ))


def downgrade() -> None:
    op.drop_column('videos', 'watch_position_updated_at')
    op.drop_column('videos', 'watch_position')
