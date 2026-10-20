from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.trip import Trip
from app.models.schemas import TripCreate, TripUpdate


class TripRepository:
    def create(self, db: Session, trip_in: TripCreate, user_id: Optional[UUID] = None) -> Trip:
        trip = Trip(
            user_id=user_id,
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

    def get_all(self, db: Session, user_id: Optional[UUID] = None) -> List[Trip]:
        query = db.query(Trip)
        if user_id:
            query = query.filter(Trip.user_id == user_id)
        return query.all()

    def get_by_id(self, db: Session, trip_id: UUID, user_id: Optional[UUID] = None) -> Optional[Trip]:
        query = db.query(Trip).filter(Trip.id == trip_id)
        if user_id:
            query = query.filter(Trip.user_id == user_id)
        return query.first()

    def update(self, db: Session, trip_id: UUID, trip_in: TripUpdate, user_id: Optional[UUID] = None) -> Optional[Trip]:
        trip = self.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return None

        update_data = trip_in.model_dump(exclude_unset=True)
        start_date = update_data.get("start_date", trip.start_date)
        end_date = update_data.get("end_date", trip.end_date)
        if end_date < start_date:
            raise ValueError("end_date cannot be earlier than start_date")

        if trip.activities:
            for act in trip.activities:
                if act.activity_date < start_date or act.activity_date > end_date:
                    raise ValueError(
                        f"Cannot adjust trip dates: activity '{act.title}' scheduled for {act.activity_date} falls outside the new range ({start_date} to {end_date})"
                    )

        if trip.expenses:
            for exp in trip.expenses:
                if exp.expense_date < start_date or exp.expense_date > end_date:
                    raise ValueError(
                        f"Cannot adjust trip dates: expense '{exp.title}' incurred on {exp.expense_date} falls outside the new range ({start_date} to {end_date})"
                    )

        for key, value in update_data.items():
            setattr(trip, key, value)

        db.commit()
        db.refresh(trip)
        return trip

    def delete(self, db: Session, trip_id: UUID, user_id: Optional[UUID] = None) -> bool:
        trip = self.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return False
        db.delete(trip)
        db.commit()
        return True


trip_repository = TripRepository()
