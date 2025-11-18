"""add tags system

Revision ID: a1b2c3d4e5f6
Revises: ec05e0687cde
Create Date: 2025-10-31

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision = 'a1b2c3d4e5f6'
down_revision = 'ec05e0687cde'
branch_labels = None
depends_on = None

def upgrade():
    # Create tags table
    op.create_table(
        'tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('color', sa.String(7), nullable=True),  # Hex color like "#3B82F6"
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Unique constraint: tag names unique per user
    op.create_unique_constraint('uq_tags_name_user_id', 'tags', ['name', 'user_id'])

    # Create video_tags junction table
    op.create_table(
        'video_tags',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('video_id', UUID(as_uuid=True), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('tag_id', UUID(as_uuid=True), sa.ForeignKey('tags.id', ondelete='CASCADE'), nullable=False),
        sa.Column('created_at', sa.DateTime, server_default=sa.func.now()),
    )

    # Unique constraint: prevent duplicate assignments
    op.create_unique_constraint('uq_video_tags_video_tag', 'video_tags', ['video_id', 'tag_id'])

    # Indexes for performance
    op.create_index('idx_video_tags_video_id', 'video_tags', ['video_id'])
    op.create_index('idx_video_tags_tag_id', 'video_tags', ['tag_id'])

def downgrade():
    op.drop_index('idx_video_tags_tag_id')
    op.drop_index('idx_video_tags_video_id')
    op.drop_table('video_tags')
    op.drop_table('tags')
