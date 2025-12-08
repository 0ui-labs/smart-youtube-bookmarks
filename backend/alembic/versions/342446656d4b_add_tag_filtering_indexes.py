"""add tag filtering indexes

Revision ID: 342446656d4b
Revises: bb2a8c34a727
Create Date: 2025-11-01 11:30:58.441752

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '342446656d4b'
down_revision: Union[str, None] = 'bb2a8c34a727'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create function-based index on LOWER(tags.name) for case-insensitive filtering
    # This index works seamlessly with ilike() queries on PostgreSQL
    op.create_index(
        'idx_tags_name_lower',
        'tags',
        [sa.text('LOWER(name)')],
        unique=False
    )


def downgrade() -> None:
    # Remove the function-based index
    op.drop_index('idx_tags_name_lower', table_name='tags')
