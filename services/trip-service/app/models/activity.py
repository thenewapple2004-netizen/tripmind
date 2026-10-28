import uuid
from sqlalchemy import CheckConstraint, Column, Index, Integer, String, Date, Numeric, ForeignKey, Text, Time
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Activity(Base):
    __tablename__ = "activities"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    location = Column(String(150), nullable=True)
    activity_date = Column(Date, nullable=False)
    cost = Column(Numeric(10, 2), nullable=False, default=0.00)

    # Scheduling. A "wall clock" time with no timezone: 09:30 means 09:30 where the trip is.
    start_time = Column(Time, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    # Manual order within a day, used for activities that have no start time.
    position = Column(Integer, nullable=False, default=0, server_default="0")

    trip = relationship("Trip", back_populates="activities")

    __table_args__ = (
        CheckConstraint(
            "duration_minutes IS NULL OR (duration_minutes >= 5 AND duration_minutes <= 1440)",
            name="ck_activities_duration_range",
        ),
        Index("ix_activities_trip_date_position", "trip_id", "activity_date", "position"),
    )

    def __repr__(self):
        return f"<Activity(id={self.id}, title='{self.title}', trip_id={self.trip_id})>"
