from typing import List, Optional
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.activity import Activity
from app.models.schemas import ActivityCreate, ActivityUpdate


class ActivityRepository:
    def next_position(self, db: Session, trip_id: UUID, day) -> int:
        """The slot after the last activity on `day`, so new items land at the end of the day."""
        last = (
            db.query(func.max(Activity.position))
            .filter(Activity.trip_id == trip_id, Activity.activity_date == day)
            .scalar()
        )
        return 0 if last is None else last + 1

    def create(self, db: Session, trip_id: UUID, activity_in: ActivityCreate) -> Activity:
        activity = Activity(
            trip_id=trip_id,
            title=activity_in.title,
            description=activity_in.description,
            location=activity_in.location,
            activity_date=activity_in.activity_date,
            cost=activity_in.cost,
            start_time=activity_in.start_time,
            duration_minutes=activity_in.duration_minutes,
            position=self.next_position(db, trip_id, activity_in.activity_date),
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
            .order_by(
                Activity.activity_date.asc(),
                Activity.start_time.is_(None),  # timed first (False sorts before True)
                Activity.start_time.asc(),
                Activity.position.asc(),
                Activity.id.asc(),
            )
            .all()
        )

    def update(self, db: Session, activity: Activity, activity_update: ActivityUpdate) -> Activity:
        update_data = activity_update.model_dump(exclude_unset=True)
        moved_day = "activity_date" in update_data and update_data["activity_date"] != activity.activity_date
        for key, value in update_data.items():
            setattr(activity, key, value)
        if moved_day:
            # Changing the date from the edit form puts it at the end of the new day.
            activity.position = self.next_position(db, activity.trip_id, activity.activity_date)
        db.commit()
        db.refresh(activity)
        return activity

    def delete(self, db: Session, activity: Activity) -> bool:
        db.delete(activity)
        db.commit()
        return True


activity_repository = ActivityRepository()
