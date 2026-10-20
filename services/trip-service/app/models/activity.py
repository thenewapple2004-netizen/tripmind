import uuid
from sqlalchemy import Column, String, Date, Numeric, ForeignKey, Text
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

    trip = relationship("Trip", back_populates="activities")

    def __repr__(self):
        return f"<Activity(id={self.id}, title='{self.title}', trip_id={self.trip_id})>"
