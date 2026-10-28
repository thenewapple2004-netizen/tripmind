"""add profile, preferences, appearance, token version and avatars

Revision ID: b7c41e9a2d10
Revises: 246bb0f3509b
Create Date: 2026-10-28 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b7c41e9a2d10'
down_revision: Union[str, Sequence[str], None] = '246bb0f3509b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('display_name', sa.String(length=80), nullable=True))
    op.add_column('users', sa.Column('bio', sa.String(length=280), nullable=True))
    op.add_column('users', sa.Column('location', sa.String(length=100), nullable=True))
    op.add_column('users', sa.Column('currency', sa.String(length=3), server_default='USD', nullable=False))
    op.add_column('users', sa.Column('timezone', sa.String(length=64), server_default='UTC', nullable=False))
    op.add_column('users', sa.Column('travel_interests', sa.JSON(), server_default=sa.text("'[]'"), nullable=False))
    op.add_column('users', sa.Column('travel_pace', sa.String(length=16), server_default='balanced', nullable=False))
    op.add_column('users', sa.Column('budget_style', sa.String(length=16), server_default='mid_range', nullable=False))
    op.add_column('users', sa.Column('theme', sa.String(length=8), server_default='dark', nullable=False))
    op.add_column('users', sa.Column('sidebar_collapsed', sa.Boolean(), server_default=sa.false(), nullable=False))
    op.add_column('users', sa.Column('token_version', sa.Integer(), server_default='0', nullable=False))
    op.add_column('users', sa.Column('password_changed_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('users', sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True))

    op.create_table(
        'user_avatars',
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('content_type', sa.String(length=32), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('user_id'),
    )


def downgrade() -> None:
    op.drop_table('user_avatars')
    for column in (
        'updated_at', 'password_changed_at', 'token_version', 'sidebar_collapsed', 'theme',
        'budget_style', 'travel_pace', 'travel_interests', 'timezone', 'currency',
        'location', 'bio', 'display_name',
    ):
        op.drop_column('users', column)
