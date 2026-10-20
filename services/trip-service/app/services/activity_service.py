from typing import List, Optional
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.activity import Activity
from app.models.schemas import ActivityCreate, ActivityUpdate
from app.services.activity_repository import activity_repository
from app.services.trip_service import trip_repository


class ActivityService:
    def _get_trip_and_verify_ownership(self, db: Session, trip_id: UUID, user_id: UUID):
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with id '{trip_id}' not found or you do not have permission",
            )
        return trip

    def create_activity(
        self, db: Session, trip_id: UUID, user_id: UUID, activity_in: ActivityCreate
    ) -> Activity:
        trip = self._get_trip_and_verify_ownership(db, trip_id, user_id)

        # Business rule: Activity date must fall within trip date range
        if activity_in.activity_date < trip.start_date or activity_in.activity_date > trip.end_date:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Activity date {activity_in.activity_date} must be between trip start date ({trip.start_date}) and end date ({trip.end_date})",
            )

        return activity_repository.create(db, trip_id, activity_in)

    def get_activities_for_trip(
        self, db: Session, trip_id: UUID, user_id: UUID
    ) -> List[Activity]:
        self._get_trip_and_verify_ownership(db, trip_id, user_id)
        return activity_repository.get_by_trip(db, trip_id)

    def get_activity(
        self, db: Session, trip_id: UUID, activity_id: UUID, user_id: UUID
    ) -> Activity:
        self._get_trip_and_verify_ownership(db, trip_id, user_id)
        activity = activity_repository.get_by_id(db, activity_id)
        if not activity or activity.trip_id != trip_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Activity with id '{activity_id}' not found for this trip",
            )
        return activity

    def update_activity(
        self, db: Session, trip_id: UUID, activity_id: UUID, user_id: UUID, activity_update: ActivityUpdate
    ) -> Activity:
        trip = self._get_trip_and_verify_ownership(db, trip_id, user_id)
        activity = self.get_activity(db, trip_id, activity_id, user_id)

        # Business rule validation for updated date
        if activity_update.activity_date is not None:
            if activity_update.activity_date < trip.start_date or activity_update.activity_date > trip.end_date:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Activity date {activity_update.activity_date} must be between trip start date ({trip.start_date}) and end date ({trip.end_date})",
                )

        return activity_repository.update(db, activity, activity_update)

    def delete_activity(
        self, db: Session, trip_id: UUID, activity_id: UUID, user_id: UUID
    ) -> bool:
        self._get_trip_and_verify_ownership(db, trip_id, user_id)
        activity = self.get_activity(db, trip_id, activity_id, user_id)
        return activity_repository.delete(db, activity)


activity_service = ActivityService()
