"""add updated_at to job_progress_events

Revision ID: ec05e0687cde
Revises: 2ce4f55587a6
Create Date: 2025-10-29 14:32:20.884614

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ec05e0687cde'
down_revision: Union[str, None] = '2ce4f55587a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'job_progress_events',
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()'))
    )


def downgrade() -> None:
    op.drop_column('job_progress_events', 'updated_at')
