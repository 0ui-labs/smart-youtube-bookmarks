"""add custom fields system

Revision ID: 1a6e18578c31
Revises: e1deab793acc
Create Date: 2025-11-05 15:01:06.486900

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB


# revision identifiers, used by Alembic.
revision: str = '1a6e18578c31'
down_revision: Union[str, None] = 'e1deab793acc'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create custom_fields table
    op.create_table(
        'custom_fields',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('bookmarks_lists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('field_type', sa.String(50), nullable=False),
        sa.Column('config', JSONB, nullable=False, server_default='{}'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Unique constraint: field names unique per list (case-sensitive for now)
    op.create_unique_constraint('uq_custom_fields_list_name', 'custom_fields', ['list_id', 'name'])

    # Check constraint: field_type must be one of 4 valid types
    op.create_check_constraint(
        'ck_custom_fields_field_type',
        'custom_fields',
        "field_type IN ('select', 'rating', 'text', 'boolean')"
    )

    # Index for list_id lookups (frequently queried when fetching all fields for a list)
    op.create_index('idx_custom_fields_list_id', 'custom_fields', ['list_id'])

    # 2. Create field_schemas table
    op.create_table(
        'field_schemas',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('list_id', UUID(as_uuid=True), sa.ForeignKey('bookmarks_lists.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Index for list_id lookups
    op.create_index('idx_field_schemas_list_id', 'field_schemas', ['list_id'])

    # 3. Create schema_fields join table (many-to-many)
    op.create_table(
        'schema_fields',
        sa.Column('schema_id', UUID(as_uuid=True), sa.ForeignKey('field_schemas.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('display_order', sa.Integer, nullable=False, server_default='0'),
        sa.Column('show_on_card', sa.Boolean, nullable=False, server_default='false'),
        sa.PrimaryKeyConstraint('schema_id', 'field_id', name='pk_schema_fields')
    )

    # Indexes for both foreign keys (bidirectional lookups)
    op.create_index('idx_schema_fields_schema_id', 'schema_fields', ['schema_id'])
    op.create_index('idx_schema_fields_field_id', 'schema_fields', ['field_id'])

    # 4. Create video_field_values table
    op.create_table(
        'video_field_values',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('video_id', UUID(as_uuid=True), sa.ForeignKey('videos.id', ondelete='CASCADE'), nullable=False),
        sa.Column('field_id', UUID(as_uuid=True), sa.ForeignKey('custom_fields.id', ondelete='CASCADE'), nullable=False),
        sa.Column('value_text', sa.Text, nullable=True),
        sa.Column('value_numeric', sa.Numeric, nullable=True),  # For ratings (1-5) and any numeric values
        sa.Column('value_boolean', sa.Boolean, nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    # Unique constraint: one value per field per video
    op.create_unique_constraint('uq_video_field_values_video_field', 'video_field_values', ['video_id', 'field_id'])

    # CRITICAL: Performance indexes for filtering operations
    # Index 1: Filter by field + numeric value (e.g., "Rating >= 4")
    op.create_index('idx_video_field_values_field_numeric', 'video_field_values', ['field_id', 'value_numeric'])

    # Index 2: Filter by field + text value (e.g., "Presentation = 'great'")
    op.create_index('idx_video_field_values_field_text', 'video_field_values', ['field_id', 'value_text'])

    # Index 3: Lookup all field values for a video (most common query)
    op.create_index('idx_video_field_values_video_field', 'video_field_values', ['video_id', 'field_id'])

    # 5. Extend tags table with schema_id
    op.add_column('tags', sa.Column('schema_id', UUID(as_uuid=True), sa.ForeignKey('field_schemas.id', ondelete='SET NULL'), nullable=True))

    # Index for schema_id lookups (for "Show all tags using this schema" feature)
    op.create_index('idx_tags_schema_id', 'tags', ['schema_id'])


def downgrade() -> None:
    # Remove in REVERSE order to avoid foreign key violations

    # 5. Remove schema_id from tags
    op.drop_index('idx_tags_schema_id', table_name='tags')
    op.drop_column('tags', 'schema_id')

    # 4. Drop video_field_values table
    op.drop_index('idx_video_field_values_video_field', table_name='video_field_values')
    op.drop_index('idx_video_field_values_field_text', table_name='video_field_values')
    op.drop_index('idx_video_field_values_field_numeric', table_name='video_field_values')
    op.drop_constraint('uq_video_field_values_video_field', 'video_field_values', type_='unique')
    op.drop_table('video_field_values')

    # 3. Drop schema_fields join table
    op.drop_index('idx_schema_fields_field_id', table_name='schema_fields')
    op.drop_index('idx_schema_fields_schema_id', table_name='schema_fields')
    op.drop_constraint('pk_schema_fields', 'schema_fields', type_='primary')
    op.drop_table('schema_fields')

    # 2. Drop field_schemas table
    op.drop_index('idx_field_schemas_list_id', table_name='field_schemas')
    op.drop_table('field_schemas')

    # 1. Drop custom_fields table
    op.drop_index('idx_custom_fields_list_id', table_name='custom_fields')
    op.drop_constraint('ck_custom_fields_field_type', 'custom_fields', type_='check')
    op.drop_constraint('uq_custom_fields_list_name', 'custom_fields', type_='unique')
    op.drop_table('custom_fields')
