"""add_not_null_constraints_to_video_tags

Revision ID: a5003ca69551
Revises: d546daacbdb4
Create Date: 2025-11-15 17:53:55.333460

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a5003ca69551'
down_revision: Union[str, None] = 'd546daacbdb4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add NOT NULL constraints to video_tags join table
    # These columns should never be NULL since they're foreign keys in a join table
    op.alter_column('video_tags', 'video_id',
                    existing_type=sa.UUID(),
                    nullable=False)
    op.alter_column('video_tags', 'tag_id',
                    existing_type=sa.UUID(),
                    nullable=False)


def downgrade() -> None:
    # Remove NOT NULL constraints
    op.alter_column('video_tags', 'tag_id',
                    existing_type=sa.UUID(),
                    nullable=True)
    op.alter_column('video_tags', 'video_id',
                    existing_type=sa.UUID(),
                    nullable=True)
