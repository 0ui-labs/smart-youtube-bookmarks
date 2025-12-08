"""add_channel_description_field

Revision ID: c8d2e5f7a9b1
Revises: b9c16061d51f
Create Date: 2025-11-24 08:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c8d2e5f7a9b1'
down_revision: Union[str, None] = 'b9c16061d51f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add description field to channels table
    op.add_column('channels', sa.Column(
        'description',
        sa.Text(),
        nullable=True,
        comment='Channel description from YouTube'
    ))


def downgrade() -> None:
    op.drop_column('channels', 'description')
