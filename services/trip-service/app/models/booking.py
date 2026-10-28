import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    JSON, CheckConstraint, Column, Date, DateTime, ForeignKey, Index, Numeric, String, Table, Text, Time,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base

BOOKING_TYPES = ("flight", "hotel", "transportation", "activity")
BOOKING_STATUSES = ("pending", "confirmed", "cancelled", "completed")

# Links a booking to documents that already exist. A row here points at the one stored file, so a
# document attached to three bookings is still stored once. Both foreign keys cascade: deleting a
# booking drops only its links, and deleting a document just unlinks it from its bookings.
booking_documents = Table(
    "booking_documents",
    Base.metadata,
    Column("booking_id", UUID(as_uuid=True), ForeignKey("bookings.id", ondelete="CASCADE"), primary_key=True),
    Column("document_id", UUID(as_uuid=True), ForeignKey("trip_documents.id", ondelete="CASCADE"), primary_key=True),
)


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)

    type = Column(String(16), nullable=False)
    status = Column(String(12), nullable=False, default="pending", server_default="pending")
    title = Column(String(150), nullable=False)
    provider = Column(String(120), nullable=True)
    confirmation_number = Column(String(60), nullable=True)

    # When it starts and ends, as wall-clock times where the booking is (no timezone), the same
    # convention the itinerary uses. A hotel's check-in/out, a flight's departure/arrival, a pickup/drop-off.
    start_date = Column(Date, nullable=False)
    start_time = Column(Time, nullable=True)
    end_date = Column(Date, nullable=True)
    end_time = Column(Time, nullable=True)
    location = Column(String(200), nullable=True)

    total_cost = Column(Numeric(10, 2), nullable=False, default=0, server_default="0")
    currency = Column(String(3), nullable=False, default="USD", server_default="USD")
    notes = Column(Text, nullable=True)

    cancellation_policy = Column(Text, nullable=True)
    free_cancellation_until = Column(Date, nullable=True)

    # Fields that only make sense for one type (flight number, pickup location...). The shape is
    # validated per type before it is saved; see `app/services/booking_rules.py`.
    details = Column(JSON, nullable=False, default=dict)

    created_at = Column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=_now, onupdate=_now)

    trip = relationship("Trip", back_populates="bookings")
    documents = relationship("TripDocument", secondary=booking_documents, back_populates="bookings", order_by="TripDocument.uploaded_at")

    __table_args__ = (
        CheckConstraint("type IN ('flight','hotel','transportation','activity')", name="ck_bookings_type"),
        CheckConstraint("status IN ('pending','confirmed','cancelled','completed')", name="ck_bookings_status"),
        CheckConstraint("total_cost >= 0", name="ck_bookings_cost_non_negative"),
        Index("ix_bookings_trip_start", "trip_id", "start_date"),
        Index("ix_bookings_status", "status"),
    )
