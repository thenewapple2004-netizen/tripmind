import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, DateTime, ForeignKey, Integer, LargeBinary, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import deferred, relationship
from app.core.database import Base


class TripDocument(Base):
    """A travel document (passport scan, ticket, booking...) stored with its trip.

    The bytes live in the database, in a `deferred` column: listing documents never loads
    them, and deleting a trip deletes its documents (ON DELETE CASCADE). There is no file
    path anywhere, so there is nothing for a crafted filename to traverse.
    """

    __tablename__ = "trip_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    filename = Column(String(255), nullable=False)
    content_type = Column(String(40), nullable=False)
    size_bytes = Column(Integer, nullable=False)
    kind = Column(String(20), nullable=False, default="other", server_default="other")
    uploaded_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    data = deferred(Column(LargeBinary, nullable=False))

    trip = relationship("Trip", back_populates="documents")
