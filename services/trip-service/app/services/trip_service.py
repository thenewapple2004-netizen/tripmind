from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.trip import Trip
from app.models.schemas import TripCreate, TripUpdate


class TripRepository:
    def create(self, db: Session, trip_in: TripCreate) -> Trip:
        trip = Trip(
            title=trip_in.title,
            destination=trip_in.destination,
            start_date=trip_in.start_date,
            end_date=trip_in.end_date,
            budget=trip_in.budget,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        return trip

    def get_all(self, db: Session) -> List[Trip]:
        return db.query(Trip).all()

    def get_by_id(self, db: Session, trip_id: UUID) -> Optional[Trip]:
        return db.query(Trip).filter(Trip.id == trip_id).first()

    def update(self, db: Session, trip_id: UUID, trip_in: TripUpdate) -> Optional[Trip]:
        trip = self.get_by_id(db, trip_id)
        if not trip:
            return None

        update_data = trip_in.model_dump(exclude_unset=True)
        # Validate date logic if dates are updated
        start_date = update_data.get("start_date", trip.start_date)
        end_date = update_data.get("end_date", trip.end_date)
        if end_date < start_date:
            raise ValueError("end_date cannot be earlier than start_date")

        for key, value in update_data.items():
            setattr(trip, key, value)

        db.commit()
        db.refresh(trip)
        return trip

    def delete(self, db: Session, trip_id: UUID) -> bool:
        trip = self.get_by_id(db, trip_id)
        if not trip:
            return False
        db.delete(trip)
        db.commit()
        return True


trip_repository = TripRepository()
