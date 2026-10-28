"""itinerary planner: activity times and order, checklist items, travel documents

Revision ID: c3d8f1a7e204
Revises: 95ac6fdde316
Create Date: 2026-10-29 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c3d8f1a7e204'
down_revision: Union[str, Sequence[str], None] = '95ac6fdde316'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Existing activities keep working: no time, no duration, position 0 (ordered by id).
    op.add_column('activities', sa.Column('start_time', sa.Time(), nullable=True))
    op.add_column('activities', sa.Column('duration_minutes', sa.Integer(), nullable=True))
    op.add_column('activities', sa.Column('position', sa.Integer(), server_default='0', nullable=False))
    op.create_check_constraint(
        'ck_activities_duration_range', 'activities',
        'duration_minutes IS NULL OR (duration_minutes >= 5 AND duration_minutes <= 1440)',
    )
    # The itinerary is always read one trip + day at a time.
    op.create_index('ix_activities_trip_date_position', 'activities', ['trip_id', 'activity_date', 'position'])

    op.create_table(
        'checklist_items',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('text', sa.String(length=200), nullable=False),
        sa.Column('category', sa.String(length=20), server_default='other', nullable=False),
        sa.Column('is_done', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('position', sa.Integer(), server_default='0', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_checklist_items_id'), 'checklist_items', ['id'], unique=False)
    op.create_index(op.f('ix_checklist_items_trip_id'), 'checklist_items', ['trip_id'], unique=False)

    op.create_table(
        'trip_documents',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('filename', sa.String(length=255), nullable=False),
        sa.Column('content_type', sa.String(length=40), nullable=False),
        sa.Column('size_bytes', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=20), server_default='other', nullable=False),
        sa.Column('uploaded_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('data', sa.LargeBinary(), nullable=False),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_trip_documents_id'), 'trip_documents', ['id'], unique=False)
    op.create_index(op.f('ix_trip_documents_trip_id'), 'trip_documents', ['trip_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_trip_documents_trip_id'), table_name='trip_documents')
    op.drop_index(op.f('ix_trip_documents_id'), table_name='trip_documents')
    op.drop_table('trip_documents')
    op.drop_index(op.f('ix_checklist_items_trip_id'), table_name='checklist_items')
    op.drop_index(op.f('ix_checklist_items_id'), table_name='checklist_items')
    op.drop_table('checklist_items')
    op.drop_index('ix_activities_trip_date_position', table_name='activities')
    op.drop_constraint('ck_activities_duration_range', 'activities', type_='check')
    op.drop_column('activities', 'position')
    op.drop_column('activities', 'duration_minutes')
    op.drop_column('activities', 'start_time')
