"""add_extended_youtube_metadata_fields

Revision ID: 0df42658a18d
Revises: 5e0cc055afa3
Create Date: 2025-11-23 15:07:36.279273

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = '0df42658a18d'
down_revision: Union[str, None] = '5e0cc055afa3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add extended YouTube metadata fields to videos table
    op.add_column('videos', sa.Column('description', sa.Text(), nullable=True))
    op.add_column('videos', sa.Column('youtube_tags', postgresql.ARRAY(sa.String()), nullable=True))
    op.add_column('videos', sa.Column('youtube_category_id', sa.String(length=10), nullable=True))
    op.add_column('videos', sa.Column('default_language', sa.String(length=10), nullable=True))
    op.add_column('videos', sa.Column('dimension', sa.String(length=5), nullable=True))
    op.add_column('videos', sa.Column('definition', sa.String(length=5), nullable=True))
    op.add_column('videos', sa.Column('has_captions', sa.Boolean(), nullable=True))
    op.add_column('videos', sa.Column('region_restriction', postgresql.JSONB(astext_type=sa.Text()), nullable=True))
    op.add_column('videos', sa.Column('view_count', sa.BigInteger(), nullable=True))
    op.add_column('videos', sa.Column('like_count', sa.BigInteger(), nullable=True))
    op.add_column('videos', sa.Column('comment_count', sa.BigInteger(), nullable=True))
    op.add_column('videos', sa.Column('privacy_status', sa.String(length=20), nullable=True))
    op.add_column('videos', sa.Column('is_embeddable', sa.Boolean(), nullable=True))


def downgrade() -> None:
    op.drop_column('videos', 'is_embeddable')
    op.drop_column('videos', 'privacy_status')
    op.drop_column('videos', 'comment_count')
    op.drop_column('videos', 'like_count')
    op.drop_column('videos', 'view_count')
    op.drop_column('videos', 'region_restriction')
    op.drop_column('videos', 'has_captions')
    op.drop_column('videos', 'definition')
    op.drop_column('videos', 'dimension')
    op.drop_column('videos', 'default_language')
    op.drop_column('videos', 'youtube_category_id')
    op.drop_column('videos', 'youtube_tags')
    op.drop_column('videos', 'description')
