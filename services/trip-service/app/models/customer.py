"""
Customer management: the people who ask the travel company to organise a trip, what they asked for,
the reminders to follow up, and the history of what happened.

Customers are records the owner keeps. They are not user accounts (they never log in), so `user_id` here
is the *owner* whose books these are. Every row carries it, and every query filters on it.
"""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    JSON, Boolean, CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Integer, Numeric, String, Text, false,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

CONTACT_METHODS = ("any", "email", "phone", "whatsapp")
INQUIRY_STAGES = ("new", "contacted", "planning", "quoted", "confirmed", "closed_lost")
OPEN_STAGES = ("new", "contacted", "planning", "quoted")
INQUIRY_SOURCES = ("referral", "website", "phone", "walk_in", "social", "repeat", "other")
EVENT_KINDS = (
    "customer_created", "customer_updated", "customer_archived", "customer_restored", "note",
    "inquiry_created", "inquiry_updated", "brief_updated", "stage_changed",
    "follow_up_created", "follow_up_completed", "follow_up_reopened", "converted_to_trip",
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Customer(Base):
    __tablename__ = "customers"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)

    name = Column(String(120), nullable=False)
    # Stored lower-cased so the per-owner uniqueness below is case-insensitive.
    email = Column(String(254), nullable=True)
    phone = Column(String(30), nullable=True)
    city = Column(String(80), nullable=True)
    country = Column(String(80), nullable=True)
    preferred_contact = Column(String(10), nullable=False, default="any", server_default="any")

    preferences = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    is_archived = Column(Boolean, nullable=False, default=False, server_default=false())

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)
    # The last time anything happened for this customer (an inquiry, a stage change, a note...).
    last_activity_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    inquiries = relationship("Inquiry", back_populates="customer", cascade="all, delete-orphan")
    follow_ups = relationship("FollowUp", back_populates="customer", cascade="all, delete-orphan")
    events = relationship("CustomerEvent", back_populates="customer", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint("preferred_contact IN ('any','email','phone','whatsapp')", name="ck_customers_preferred_contact"),
        # One customer per email for an owner. NULL emails are distinct, so customers without one don't collide.
        Index("uq_customers_user_email", "user_id", "email", unique=True),
        Index("ix_customers_user_name", "user_id", "name"),
    )

    def __repr__(self):
        return f"<Customer(id={self.id})>"  # never the name or contact details


class Inquiry(Base):
    __tablename__ = "inquiries"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)

    destination = Column(String(100), nullable=False)
    date_from = Column(Date, nullable=True)
    date_to = Column(Date, nullable=True)
    travelers = Column(Integer, nullable=False, default=1, server_default="1")
    budget_min = Column(Numeric(12, 2), nullable=True)
    budget_max = Column(Numeric(12, 2), nullable=True)
    currency = Column(String(3), nullable=False, default="USD", server_default="USD")
    source = Column(String(12), nullable=False, default="other", server_default="other")
    notes = Column(Text, nullable=True)

    stage = Column(String(12), nullable=False, default="new", server_default="new")
    stage_changed_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    closed_reason = Column(String(300), nullable=True)

    # The travel brief: the detailed requirements, validated by `TravelBrief` before it is saved.
    brief = Column(JSON, nullable=False, default=dict)

    # Set once, when the inquiry is converted. The unique index is what stops two conversions of the same
    # inquiry from racing; the trip itself is an ordinary trip owned by the same user.
    converted_trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="SET NULL"), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    customer = relationship("Customer", back_populates="inquiries")
    follow_ups = relationship("FollowUp", back_populates="inquiry", cascade="all, delete-orphan")

    __table_args__ = (
        CheckConstraint(
            "stage IN ('new','contacted','planning','quoted','confirmed','closed_lost')", name="ck_inquiries_stage"
        ),
        CheckConstraint("travelers >= 1", name="ck_inquiries_travelers"),
        CheckConstraint("budget_min IS NULL OR budget_min >= 0", name="ck_inquiries_budget_min"),
        CheckConstraint("budget_max IS NULL OR budget_max >= 0", name="ck_inquiries_budget_max"),
        CheckConstraint(
            "budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max", name="ck_inquiries_budget_range"
        ),
        CheckConstraint(
            "date_from IS NULL OR date_to IS NULL OR date_to >= date_from", name="ck_inquiries_dates"
        ),
        Index("ix_inquiries_user_stage", "user_id", "stage"),
        Index("uq_inquiries_converted_trip", "converted_trip_id", unique=True),
    )


class FollowUp(Base):
    __tablename__ = "follow_ups"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    inquiry_id = Column(UUID(as_uuid=True), ForeignKey("inquiries.id", ondelete="CASCADE"), nullable=True, index=True)

    title = Column(String(150), nullable=False)
    notes = Column(Text, nullable=True)
    due_date = Column(Date, nullable=False)
    completed_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    customer = relationship("Customer", back_populates="follow_ups")
    inquiry = relationship("Inquiry", back_populates="follow_ups")

    __table_args__ = (Index("ix_follow_ups_user_due", "user_id", "completed_at", "due_date"),)


class CustomerEvent(Base):
    """One line of history. Stage changes are events with `from_stage` and `to_stage` set, so the pipeline
    history and the customer's timeline are the same record. `summary` never holds contact details."""

    __tablename__ = "customer_events"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    customer_id = Column(UUID(as_uuid=True), ForeignKey("customers.id", ondelete="CASCADE"), nullable=False, index=True)
    # History outlives a deleted inquiry: the customer's timeline still says what happened.
    inquiry_id = Column(UUID(as_uuid=True), ForeignKey("inquiries.id", ondelete="SET NULL"), nullable=True, index=True)

    kind = Column(String(24), nullable=False)
    from_stage = Column(String(12), nullable=True)
    to_stage = Column(String(12), nullable=True)
    summary = Column(String(600), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)

    customer = relationship("Customer", back_populates="events")

    __table_args__ = (Index("ix_customer_events_customer_created", "customer_id", "created_at"),)
