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

    # Create GIN index on value_text column using trigram ops
    # This enables efficient ILIKE queries with leading wildcards (e.g., '%text%')
    op.execute('''
        CREATE INDEX idx_vfv_text_trgm ON video_field_values
        USING gin (value_text gin_trgm_ops);
    ''')


def downgrade() -> None:
    # Drop the GIN index first
    op.execute('DROP INDEX IF EXISTS idx_vfv_text_trgm;')

    # Drop the pg_trgm extension
    op.execute('DROP EXTENSION IF EXISTS pg_trgm;')
