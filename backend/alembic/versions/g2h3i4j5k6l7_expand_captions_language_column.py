"""expand_captions_language_column

Revision ID: g2h3i4j5k6l7
Revises: f1a2b3c4d5e6
Create Date: 2025-11-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'g2h3i4j5k6l7'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Expand captions_language from VARCHAR(10) to VARCHAR(50)
    # to accommodate language codes like 'en-nP7-2PuUl7o'
    op.alter_column(
        'video_enrichments',
        'captions_language',
        type_=sa.String(length=50),
        existing_type=sa.String(length=10),
        existing_nullable=True
    )


def downgrade() -> None:
    # Revert to VARCHAR(10) - note: this may truncate data
    op.alter_column(
        'video_enrichments',
        'captions_language',
        type_=sa.String(length=10),
        existing_type=sa.String(length=50),
        existing_nullable=True
    )
