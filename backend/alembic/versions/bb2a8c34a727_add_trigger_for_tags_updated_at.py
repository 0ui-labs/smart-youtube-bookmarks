"""add trigger for tags updated_at

Revision ID: bb2a8c34a727
Revises: a1b2c3d4e5f6
Create Date: 2025-11-01 09:24:43.419967

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'bb2a8c34a727'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create function to update updated_at timestamp
    op.execute("""
        CREATE OR REPLACE FUNCTION update_updated_at_column()
        RETURNS TRIGGER AS $$
        BEGIN
            NEW.updated_at = NOW();
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # Create trigger for tags table
    op.execute("""
        CREATE TRIGGER update_tags_updated_at
        BEFORE UPDATE ON tags
        FOR EACH ROW
        EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade() -> None:
    # Drop trigger
    op.execute("DROP TRIGGER IF EXISTS update_tags_updated_at ON tags;")

    # Drop function
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column();")

