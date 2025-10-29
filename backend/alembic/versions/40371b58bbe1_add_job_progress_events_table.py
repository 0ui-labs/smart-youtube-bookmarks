"""add job progress events table

Revision ID: 40371b58bbe1
Revises: 4c5746129061
Create Date: 2025-10-28 16:11:53.873968

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '40371b58bbe1'
down_revision: Union[str, None] = '4c5746129061'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'job_progress_events',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('job_id', UUID(as_uuid=True), sa.ForeignKey('processing_jobs.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('now()')),
        sa.Column('progress_data', JSONB, nullable=False)
    )

    # Index for chronological queries by job
    op.create_index(
        'idx_job_progress_job_created',
        'job_progress_events',
        ['job_id', sa.text('created_at DESC')]
    )


def downgrade() -> None:
    op.drop_index('idx_job_progress_job_created', table_name='job_progress_events')
    op.drop_table('job_progress_events')
