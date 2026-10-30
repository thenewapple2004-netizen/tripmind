"""customer management hub: customers, inquiries, follow-ups, history, trips.customer_id

Revision ID: e8b2f4a6c913
Revises: d5e92b4c8a17
Create Date: 2026-10-30 14:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'e8b2f4a6c913'
down_revision: Union[str, Sequence[str], None] = 'd5e92b4c8a17'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'customers',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('name', sa.String(length=120), nullable=False),
        sa.Column('email', sa.String(length=254), nullable=True),
        sa.Column('phone', sa.String(length=30), nullable=True),
        sa.Column('city', sa.String(length=80), nullable=True),
        sa.Column('country', sa.String(length=80), nullable=True),
        sa.Column('preferred_contact', sa.String(length=10), server_default='any', nullable=False),
        sa.Column('preferences', sa.Text(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_archived', sa.Boolean(), server_default=sa.false(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('last_activity_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("preferred_contact IN ('any','email','phone','whatsapp')", name='ck_customers_preferred_contact'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_customers_id'), 'customers', ['id'], unique=False)
    op.create_index(op.f('ix_customers_user_id'), 'customers', ['user_id'], unique=False)
    op.create_index('uq_customers_user_email', 'customers', ['user_id', 'email'], unique=True)
    op.create_index('ix_customers_user_name', 'customers', ['user_id', 'name'], unique=False)

    op.create_table(
        'inquiries',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('destination', sa.String(length=100), nullable=False),
        sa.Column('date_from', sa.Date(), nullable=True),
        sa.Column('date_to', sa.Date(), nullable=True),
        sa.Column('travelers', sa.Integer(), server_default='1', nullable=False),
        sa.Column('budget_min', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('budget_max', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('currency', sa.String(length=3), server_default='USD', nullable=False),
        sa.Column('source', sa.String(length=12), server_default='other', nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('stage', sa.String(length=12), server_default='new', nullable=False),
        sa.Column('stage_changed_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('closed_reason', sa.String(length=300), nullable=True),
        sa.Column('brief', sa.JSON(), nullable=False),
        sa.Column('converted_trip_id', sa.UUID(), nullable=True),
        sa.Column('converted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("stage IN ('new','contacted','planning','quoted','confirmed','closed_lost')", name='ck_inquiries_stage'),
        sa.CheckConstraint('travelers >= 1', name='ck_inquiries_travelers'),
        sa.CheckConstraint('budget_min IS NULL OR budget_min >= 0', name='ck_inquiries_budget_min'),
        sa.CheckConstraint('budget_max IS NULL OR budget_max >= 0', name='ck_inquiries_budget_max'),
        sa.CheckConstraint('budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max', name='ck_inquiries_budget_range'),
        sa.CheckConstraint('date_from IS NULL OR date_to IS NULL OR date_to >= date_from', name='ck_inquiries_dates'),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['converted_trip_id'], ['trips.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_inquiries_id'), 'inquiries', ['id'], unique=False)
    op.create_index(op.f('ix_inquiries_user_id'), 'inquiries', ['user_id'], unique=False)
    op.create_index(op.f('ix_inquiries_customer_id'), 'inquiries', ['customer_id'], unique=False)
    op.create_index('ix_inquiries_user_stage', 'inquiries', ['user_id', 'stage'], unique=False)
    op.create_index('uq_inquiries_converted_trip', 'inquiries', ['converted_trip_id'], unique=True)

    op.create_table(
        'follow_ups',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('inquiry_id', sa.UUID(), nullable=True),
        sa.Column('title', sa.String(length=150), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('due_date', sa.Date(), nullable=False),
        sa.Column('completed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inquiry_id'], ['inquiries.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_follow_ups_id'), 'follow_ups', ['id'], unique=False)
    op.create_index(op.f('ix_follow_ups_user_id'), 'follow_ups', ['user_id'], unique=False)
    op.create_index(op.f('ix_follow_ups_customer_id'), 'follow_ups', ['customer_id'], unique=False)
    op.create_index(op.f('ix_follow_ups_inquiry_id'), 'follow_ups', ['inquiry_id'], unique=False)
    op.create_index('ix_follow_ups_user_due', 'follow_ups', ['user_id', 'completed_at', 'due_date'], unique=False)

    op.create_table(
        'customer_events',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('customer_id', sa.UUID(), nullable=False),
        sa.Column('inquiry_id', sa.UUID(), nullable=True),
        sa.Column('kind', sa.String(length=24), nullable=False),
        sa.Column('from_stage', sa.String(length=12), nullable=True),
        sa.Column('to_stage', sa.String(length=12), nullable=True),
        sa.Column('summary', sa.String(length=600), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['customer_id'], ['customers.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['inquiry_id'], ['inquiries.id'], ondelete='SET NULL'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_customer_events_id'), 'customer_events', ['id'], unique=False)
    op.create_index(op.f('ix_customer_events_user_id'), 'customer_events', ['user_id'], unique=False)
    op.create_index(op.f('ix_customer_events_customer_id'), 'customer_events', ['customer_id'], unique=False)
    op.create_index(op.f('ix_customer_events_inquiry_id'), 'customer_events', ['inquiry_id'], unique=False)
    op.create_index('ix_customer_events_customer_created', 'customer_events', ['customer_id', 'created_at'], unique=False)

    # Existing trips are personal trips: the column starts empty and stays empty for them.
    op.add_column('trips', sa.Column('customer_id', sa.UUID(), nullable=True))
    op.create_index(op.f('ix_trips_customer_id'), 'trips', ['customer_id'], unique=False)
    op.create_foreign_key('fk_trips_customer_id', 'trips', 'customers', ['customer_id'], ['id'], ondelete='SET NULL')


def downgrade() -> None:
    op.drop_constraint('fk_trips_customer_id', 'trips', type_='foreignkey')
    op.drop_index(op.f('ix_trips_customer_id'), table_name='trips')
    op.drop_column('trips', 'customer_id')

    op.drop_index('ix_customer_events_customer_created', table_name='customer_events')
    op.drop_index(op.f('ix_customer_events_inquiry_id'), table_name='customer_events')
    op.drop_index(op.f('ix_customer_events_customer_id'), table_name='customer_events')
    op.drop_index(op.f('ix_customer_events_user_id'), table_name='customer_events')
    op.drop_index(op.f('ix_customer_events_id'), table_name='customer_events')
    op.drop_table('customer_events')

    op.drop_index('ix_follow_ups_user_due', table_name='follow_ups')
    op.drop_index(op.f('ix_follow_ups_inquiry_id'), table_name='follow_ups')
    op.drop_index(op.f('ix_follow_ups_customer_id'), table_name='follow_ups')
    op.drop_index(op.f('ix_follow_ups_user_id'), table_name='follow_ups')
    op.drop_index(op.f('ix_follow_ups_id'), table_name='follow_ups')
    op.drop_table('follow_ups')

    op.drop_index('uq_inquiries_converted_trip', table_name='inquiries')
    op.drop_index('ix_inquiries_user_stage', table_name='inquiries')
    op.drop_index(op.f('ix_inquiries_customer_id'), table_name='inquiries')
    op.drop_index(op.f('ix_inquiries_user_id'), table_name='inquiries')
    op.drop_index(op.f('ix_inquiries_id'), table_name='inquiries')
    op.drop_table('inquiries')

    op.drop_index('ix_customers_user_name', table_name='customers')
    op.drop_index('uq_customers_user_email', table_name='customers')
    op.drop_index(op.f('ix_customers_user_id'), table_name='customers')
    op.drop_index(op.f('ix_customers_id'), table_name='customers')
    op.drop_table('customers')
