"""add_check_constraint_for_video_field_values

Revision ID: d546daacbdb4
Revises: 910b10b27e0b
Create Date: 2025-11-15 16:16:10.500355

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'd546daacbdb4'
down_revision: Union[str, None] = '910b10b27e0b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """
    Add check constraint to video_field_values table to ensure data integrity.

    Enforces that exactly one value column is populated based on field type,
    OR all three are NULL (for cleared/deleted field values).

    This prevents inconsistent data where multiple value columns are set
    simultaneously, which would be ambiguous and indicate a data corruption bug.
    """
    op.create_check_constraint(
        'ck_video_field_values_single_value',
        'video_field_values',
        """
        -- Allow either exactly one value column to be set...
        (value_text IS NOT NULL AND value_numeric IS NULL AND value_boolean IS NULL) OR
        (value_text IS NULL AND value_numeric IS NOT NULL AND value_boolean IS NULL) OR
        (value_text IS NULL AND value_numeric IS NULL AND value_boolean IS NOT NULL) OR
        -- ...or all three NULL (for cleared field values)
        (value_text IS NULL AND value_numeric IS NULL AND value_boolean IS NULL)
        """
    )


def downgrade() -> None:
    """Remove the check constraint added in upgrade."""
    op.drop_constraint(
        'ck_video_field_values_single_value',
        'video_field_values',
        type_='check'
    )
