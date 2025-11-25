"""add_progress_message_to_video_enrichments

Revision ID: f1a2b3c4d5e6
Revises: ae1b50a56ff5
Create Date: 2025-11-25 17:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'ae1b50a56ff5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add progress_message column to video_enrichments table
    op.add_column(
        'video_enrichments',
        sa.Column('progress_message', sa.String(length=100), nullable=True)
    )


def downgrade() -> None:
    # Remove progress_message column
    op.drop_column('video_enrichments', 'progress_message')
