import uuid
from sqlalchemy import Column, String, Date, Numeric
from sqlalchemy.dialects.postgresql import UUID
from app.core.database import Base


class Trip(Base):
    __tablename__ = "trips"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    user_id = Column(UUID(as_uuid=True), index=True, nullable=True)  # nullable for backwards compatibility
    title = Column(String(100), nullable=False)
    destination = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    budget = Column(Numeric(10, 2), nullable=False)

    def __repr__(self):
        return f"<Trip(id={self.id}, user_id={self.user_id}, title='{self.title}')>"
