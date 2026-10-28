"""create bookings and booking_documents

Revision ID: d5e92b4c8a17
Revises: c3d8f1a7e204
Create Date: 2026-10-30 10:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd5e92b4c8a17'
down_revision: Union[str, Sequence[str], None] = 'c3d8f1a7e204'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'bookings',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('trip_id', sa.UUID(), nullable=False),
        sa.Column('type', sa.String(length=16), nullable=False),
        sa.Column('status', sa.String(length=12), server_default='pending', nullable=False),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('provider', sa.String(length=120), nullable=True),
        sa.Column('confirmation_number', sa.String(length=60), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=False),
        sa.Column('start_time', sa.Time(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('end_time', sa.Time(), nullable=True),
        sa.Column('location', sa.String(length=200), nullable=True),
        sa.Column('total_cost', sa.Numeric(precision=10, scale=2), server_default='0', nullable=False),
        sa.Column('currency', sa.String(length=3), server_default='USD', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('cancellation_policy', sa.Text(), nullable=True),
        sa.Column('free_cancellation_until', sa.Date(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("type IN ('flight','hotel','transportation','activity')", name='ck_bookings_type'),
        sa.CheckConstraint("status IN ('pending','confirmed','cancelled','completed')", name='ck_bookings_status'),
        sa.CheckConstraint('total_cost >= 0', name='ck_bookings_cost_non_negative'),
        sa.ForeignKeyConstraint(['trip_id'], ['trips.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_bookings_id'), 'bookings', ['id'], unique=False)
    op.create_index(op.f('ix_bookings_trip_id'), 'bookings', ['trip_id'], unique=False)
    op.create_index('ix_bookings_trip_start', 'bookings', ['trip_id', 'start_date'], unique=False)
    op.create_index('ix_bookings_status', 'bookings', ['status'], unique=False)

    op.create_table(
        'booking_documents',
        sa.Column('booking_id', sa.UUID(), nullable=False),
        sa.Column('document_id', sa.UUID(), nullable=False),
        sa.ForeignKeyConstraint(['booking_id'], ['bookings.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['document_id'], ['trip_documents.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('booking_id', 'document_id'),
    )
    # Looking up "which bookings use this document" (and cascading a document delete) goes by document.
    op.create_index('ix_booking_documents_document_id', 'booking_documents', ['document_id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_booking_documents_document_id', table_name='booking_documents')
    op.drop_table('booking_documents')
    op.drop_index('ix_bookings_status', table_name='bookings')
    op.drop_index('ix_bookings_trip_start', table_name='bookings')
    op.drop_index(op.f('ix_bookings_trip_id'), table_name='bookings')
    op.drop_index(op.f('ix_bookings_id'), table_name='bookings')
    op.drop_table('bookings')
