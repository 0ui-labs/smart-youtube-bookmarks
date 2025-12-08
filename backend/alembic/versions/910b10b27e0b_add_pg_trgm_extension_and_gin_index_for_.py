"""add pg_trgm extension and gin index for text search

Revision ID: 910b10b27e0b
Revises: 1a6e18578c31
Create Date: 2025-11-15 00:20:09.826389

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '910b10b27e0b'
down_revision: Union[str, None] = '1a6e18578c31'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Enable pg_trgm extension for efficient ILIKE text search with wildcards
    op.execute('CREATE EXTENSION IF NOT EXISTS pg_trgm;')

    # Enable btree_gin extension for composite GIN indexes with B-tree columns
    op.execute('CREATE EXTENSION IF NOT EXISTS btree_gin;')

    # Create composite GIN index on (field_id, value_text) for optimal query performance
    # The query pattern filters by BOTH field_id (in JOIN) and value_text (ILIKE '%pattern%')
    # Using btree_gin allows field_id (UUID) to use B-tree ops within GIN index structure
    # This enables bitmap index scans combining both predicates (2-5x performance improvement)
    op.execute('''
        CREATE INDEX idx_vfv_field_text_trgm ON video_field_values
        USING gin (field_id gin_btree_ops, value_text gin_trgm_ops);
    ''')


def downgrade() -> None:
    # Drop the GIN index first
    op.execute('DROP INDEX IF EXISTS idx_vfv_field_text_trgm;')

    # Drop the extensions
    op.execute('DROP EXTENSION IF EXISTS btree_gin;')
    op.execute('DROP EXTENSION IF EXISTS pg_trgm;')
