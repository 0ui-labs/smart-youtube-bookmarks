"""add error_message to processing_jobs (manual)

Revision ID: e1deab793acc
Revises: 31e210ddc932
Create Date: 2025-11-01 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1deab793acc'
down_revision: Union[str, None] = '31e210ddc932'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add error_message column to processing_jobs table
    op.add_column('processing_jobs', sa.Column('error_message', sa.Text(), nullable=True))


def downgrade() -> None:
    # Remove error_message column from processing_jobs table
    op.drop_column('processing_jobs', 'error_message')
