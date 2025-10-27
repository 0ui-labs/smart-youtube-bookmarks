"""Initial schema

Revision ID: 4c5746129061
Revises:
Create Date: 2025-10-27 17:47:38.848890

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '4c5746129061'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create schemas table
    op.create_table('schemas',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('fields', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
    sa.PrimaryKeyConstraint('id')
    )

    # Create bookmarks_lists table
    op.create_table('bookmarks_lists',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('name', sa.String(length=255), nullable=False),
    sa.Column('description', sa.Text(), nullable=True),
    sa.Column('schema_id', postgresql.UUID(as_uuid=True), nullable=True),
    sa.ForeignKeyConstraint(['schema_id'], ['schemas.id'], ondelete='SET NULL'),
    sa.PrimaryKeyConstraint('id')
    )

    # Create videos table
    op.create_table('videos',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('list_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('youtube_id', sa.String(length=50), nullable=False),
    sa.Column('title', sa.String(length=500), nullable=True),
    sa.Column('channel', sa.String(length=255), nullable=True),
    sa.Column('duration', sa.Integer(), nullable=True),
    sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
    sa.Column('thumbnail_url', sa.String(length=500), nullable=True),
    sa.Column('extracted_data', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    sa.Column('processing_status', sa.String(length=20), server_default='pending', nullable=False),
    sa.Column('error_message', sa.String(), nullable=True),
    sa.ForeignKeyConstraint(['list_id'], ['bookmarks_lists.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_videos_list_id', 'videos', ['list_id'], unique=False)
    op.create_index('idx_videos_status', 'videos', ['processing_status'], unique=False)
    op.create_index('idx_videos_list_youtube', 'videos', ['list_id', 'youtube_id'], unique=True)

    # Create processing_jobs table
    op.create_table('processing_jobs',
    sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    sa.Column('list_id', postgresql.UUID(as_uuid=True), nullable=False),
    sa.Column('total_videos', sa.Integer(), nullable=False),
    sa.Column('processed_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('failed_count', sa.Integer(), server_default='0', nullable=False),
    sa.Column('status', sa.String(length=20), server_default='running', nullable=False),
    sa.ForeignKeyConstraint(['list_id'], ['bookmarks_lists.id'], ondelete='CASCADE'),
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_jobs_list_id', 'processing_jobs', ['list_id'], unique=False)
    op.create_index('idx_jobs_status', 'processing_jobs', ['status'], unique=False)


def downgrade() -> None:
    # Drop tables in reverse order
    op.drop_index('idx_jobs_status', table_name='processing_jobs')
    op.drop_index('idx_jobs_list_id', table_name='processing_jobs')
    op.drop_table('processing_jobs')

    op.drop_index('idx_videos_list_youtube', table_name='videos')
    op.drop_index('idx_videos_status', table_name='videos')
    op.drop_index('idx_videos_list_id', table_name='videos')
    op.drop_table('videos')

    op.drop_table('bookmarks_lists')
    op.drop_table('schemas')
