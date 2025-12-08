"""extend_processing_jobs_status_to_varchar_30

Revision ID: 4569d28dcdb7
Revises: a5003ca69551
Create Date: 2025-11-16 19:46:46.421405

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4569d28dcdb7'
down_revision: Union[str, None] = 'a5003ca69551'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Extend status column from VARCHAR(20) to VARCHAR(30) to accommodate "completed_with_errors"
    op.alter_column('processing_jobs', 'status',
                    existing_type=sa.String(length=20),
                    type_=sa.String(length=30),
                    existing_nullable=False)


def downgrade() -> None:
    # Revert status column back to VARCHAR(20)
    op.alter_column('processing_jobs', 'status',
                    existing_type=sa.String(length=30),
                    type_=sa.String(length=20),
                    existing_nullable=False)
