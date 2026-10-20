from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.activity import Activity
from app.models.schemas import ActivityCreate, ActivityUpdate


class ActivityRepository:
    def create(self, db: Session, trip_id: UUID, activity_in: ActivityCreate) -> Activity:
        activity = Activity(
            trip_id=trip_id,
            title=activity_in.title,
            description=activity_in.description,
            location=activity_in.location,
            activity_date=activity_in.activity_date,
            cost=activity_in.cost,
        )
        db.add(activity)
        db.commit()
        db.refresh(activity)
        return activity

    def get_by_id(self, db: Session, activity_id: UUID) -> Optional[Activity]:
        return db.query(Activity).filter(Activity.id == activity_id).first()

    def get_by_trip(self, db: Session, trip_id: UUID) -> List[Activity]:
        return (
            db.query(Activity)
            .filter(Activity.trip_id == trip_id)
            .order_by(Activity.activity_date.asc())
            .all()
        )

    def update(self, db: Session, activity: Activity, activity_update: ActivityUpdate) -> Activity:
        update_data = activity_update.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(activity, key, value)
        db.commit()
        db.refresh(activity)
        return activity

    def delete(self, db: Session, activity: Activity) -> bool:
        db.delete(activity)
        db.commit()
        return True


activity_repository = ActivityRepository()
