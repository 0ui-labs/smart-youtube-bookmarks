"""add is_video_type and default_schema_id

Revision ID: 5e0cc055afa3
Revises: 4569d28dcdb7
Create Date: 2025-11-21 23:36:11.336593

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


# revision identifiers, used by Alembic.
revision: str = '5e0cc055afa3'
down_revision: Union[str, None] = '4569d28dcdb7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1.2: Add is_video_type to tags table
    # True = video type/category (only one per video), False = label (multiple allowed)
    op.add_column(
        'tags',
        sa.Column('is_video_type', sa.Boolean(), nullable=False, server_default='true')
    )
    op.create_index('idx_tags_is_video_type', 'tags', ['is_video_type'])

    # Step 1.3: Add default_schema_id to bookmarks_lists table
    # Workspace-wide schema (fields for all videos in this list)
    op.add_column(
        'bookmarks_lists',
        sa.Column(
            'default_schema_id',
            UUID(as_uuid=True),
            sa.ForeignKey('field_schemas.id', ondelete='SET NULL'),
            nullable=True
        )
    )
    op.create_index('idx_bookmarks_lists_default_schema', 'bookmarks_lists', ['default_schema_id'])


def downgrade() -> None:
    # Step 1.4: Reverse all changes
    op.drop_index('idx_bookmarks_lists_default_schema', table_name='bookmarks_lists')
    op.drop_column('bookmarks_lists', 'default_schema_id')
    op.drop_index('idx_tags_is_video_type', table_name='tags')
    op.drop_column('tags', 'is_video_type')
