"""add_channels_table_and_video_channel_fk

Revision ID: b9c16061d51f
Revises: 0df42658a18d
Create Date: 2025-11-23 21:03:08.598697

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b9c16061d51f'
down_revision: Union[str, None] = '0df42658a18d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Create channels table
    op.create_table('channels',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('youtube_channel_id', sa.String(length=50), nullable=False,
                  comment="YouTube's channel ID (e.g., UCX6OQ3DkcsbYNE6H8uQQuVA)"),
        sa.Column('name', sa.String(length=255), nullable=False,
                  comment='Channel display name from YouTube'),
        sa.Column('thumbnail_url', sa.String(length=500), nullable=True,
                  comment='Channel avatar URL from YouTube'),
        sa.Column('is_hidden', sa.Boolean(), server_default='false', nullable=False,
                  comment="Hidden channels don't appear in sidebar"),
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True),
                  server_default=sa.text('clock_timestamp()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('idx_channels_user_id', 'channels', ['user_id'], unique=False)
    op.create_index('idx_channels_user_youtube', 'channels', ['user_id', 'youtube_channel_id'], unique=True)

    # Add channel_id FK to videos table
    op.add_column('videos', sa.Column('channel_id', sa.UUID(), nullable=True))
    op.create_index('ix_videos_channel_id', 'videos', ['channel_id'], unique=False)
    op.create_foreign_key(
        'fk_videos_channel_id',
        'videos', 'channels',
        ['channel_id'], ['id'],
        ondelete='SET NULL'
    )


def downgrade() -> None:
    # Remove FK and column from videos
    op.drop_constraint('fk_videos_channel_id', 'videos', type_='foreignkey')
    op.drop_index('ix_videos_channel_id', table_name='videos')
    op.drop_column('videos', 'channel_id')

    # Drop channels table
    op.drop_index('idx_channels_user_youtube', table_name='channels')
    op.drop_index('idx_channels_user_id', table_name='channels')
    op.drop_table('channels')
