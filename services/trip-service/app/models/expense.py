import uuid
from sqlalchemy import Column, String, Date, Numeric, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


class Expense(Base):
    __tablename__ = "expenses"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    trip_id = Column(UUID(as_uuid=True), ForeignKey("trips.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(150), nullable=False)
    amount = Column(Numeric(10, 2), nullable=False)
    category = Column(String(50), nullable=False, default="Other", index=True)
    expense_date = Column(Date, nullable=False)
    description = Column(Text, nullable=True)

    trip = relationship("Trip", back_populates="expenses")

    def __repr__(self):
        return f"<Expense(id={self.id}, title='{self.title}', amount={self.amount}, category='{self.category}')>"
