"""add case insensitive unique index for tags

Revision ID: 31e210ddc932
Revises: 342446656d4b
Create Date: 2025-11-01 15:13:47.098332

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '31e210ddc932'
down_revision: Union[str, None] = '342446656d4b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create case-insensitive unique index for tags
    # This prevents duplicate tags with different casing (e.g., "Python" and "python")
    # Uses PostgreSQL's functional index with lower() function
    op.create_index(
        'idx_tags_user_name_lower',
        'tags',
        [sa.text('user_id'), sa.text('lower(name)')],
        unique=True
    )


def downgrade() -> None:
    # Drop the case-insensitive unique index
    op.drop_index('idx_tags_user_name_lower', table_name='tags')
