"""add users table and user_id to bookmarks_lists

Revision ID: 2ce4f55587a6
Revises: 40371b58bbe1
Create Date: 2025-10-28 23:10:14.630050

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision: str = '2ce4f55587a6'
down_revision: Union[str, None] = '40371b58bbe1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Step 1: Create users table
    op.create_table(
        'users',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('is_active', sa.Boolean(), server_default='true', nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index('ix_users_email', 'users', ['email'], unique=True)

    # Step 2: Create a default test user for existing data
    # Generate a UUID for the default user
    default_user_id = str(uuid.uuid4())

    # Insert default test user
    op.execute(
        f"""
        INSERT INTO users (id, email, hashed_password, is_active)
        VALUES ('{default_user_id}', 'test@example.com', '$2b$12$placeholder_hash', true)
        """
    )

    # Step 3: Add user_id column as nullable first
    op.add_column(
        'bookmarks_lists',
        sa.Column('user_id', postgresql.UUID(as_uuid=True), nullable=True)
    )

    # Step 4: Set default user_id for existing rows
    op.execute(
        f"""
        UPDATE bookmarks_lists
        SET user_id = '{default_user_id}'
        WHERE user_id IS NULL
        """
    )

    # Step 5: Make user_id NOT NULL and add constraints
    op.alter_column('bookmarks_lists', 'user_id', nullable=False)
    op.create_foreign_key(
        'fk_bookmarks_lists_user_id',
        'bookmarks_lists', 'users',
        ['user_id'], ['id'],
        ondelete='CASCADE'
    )
    op.create_index('idx_bookmarks_lists_user_id', 'bookmarks_lists', ['user_id'])


def downgrade() -> None:
    # Drop foreign key and index first
    op.drop_index('idx_bookmarks_lists_user_id', table_name='bookmarks_lists')
    op.drop_constraint('fk_bookmarks_lists_user_id', 'bookmarks_lists', type_='foreignkey')
    op.drop_column('bookmarks_lists', 'user_id')

    # Drop users table
    op.drop_index('ix_users_email', table_name='users')
    op.drop_table('users')
