import uuid
from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, false
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class ChecklistItem(Base):
    __tablename__ = "checklist_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    text = Column(String(200), nullable=False)
    category = Column(String(20), nullable=False, default="other", server_default="other")
    is_done = Column(Boolean, nullable=False, default=False, server_default=false())
    position = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    trip = relationship("Trip", back_populates="checklist_items")
