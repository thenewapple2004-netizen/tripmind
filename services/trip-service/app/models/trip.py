import uuid
from sqlalchemy import Column, String, Date, Numeric, Index
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=True)
    title = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    budget = Column(Numeric(10, 2), nullable=False)

    __table_args__ = (
        Index("ix_trips_user_start_date", "user_id", "start_date"),
        Index("ix_trips_user_budget", "user_id", "budget"),
        Index("ix_trips_title", "title"),
        Index("ix_trips_destination", "destination"),
    )

    activities = relationship(
        "Activity",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="Activity.activity_date",
    )
    expenses = relationship(
        "Expense",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="Expense.expense_date",
    )
    checklist_items = relationship(
        "ChecklistItem",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="ChecklistItem.position",
    )
    bookings = relationship(
        "Booking",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="Booking.start_date",
    )
    documents = relationship(
        "TripDocument",
        back_populates="trip",
        cascade="all, delete-orphan",
        order_by="TripDocument.uploaded_at",
    )

    def __repr__(self):
        return f"<Trip(id={self.id}, user_id={self.user_id}, title='{self.title}')>"
