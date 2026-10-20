from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import ActivityCreate, ActivityResponse, ActivityUpdate
from app.services.activity_service import activity_service

router = APIRouter(prefix="/trips/{trip_id}/activities", tags=["Activities"])


@router.post("", response_model=ActivityResponse, status_code=status.HTTP_201_CREATED)
def create_activity(
    trip_id: UUID,
    activity_in: ActivityCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Add a new activity to a trip owned by the authenticated user."""
    return activity_service.create_activity(db, trip_id, user_id, activity_in)


@router.get("", response_model=List[ActivityResponse])
def get_trip_activities(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """List all activities for a trip owned by the authenticated user."""
    return activity_service.get_activities_for_trip(db, trip_id, user_id)


@router.get("/{activity_id}", response_model=ActivityResponse)
def get_activity(
    trip_id: UUID,
    activity_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Get single activity details."""
    return activity_service.get_activity(db, trip_id, activity_id, user_id)


@router.patch("/{activity_id}", response_model=ActivityResponse)
def update_activity(
    trip_id: UUID,
    activity_id: UUID,
    activity_update: ActivityUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Update an activity within a trip owned by the authenticated user."""
    return activity_service.update_activity(db, trip_id, activity_id, user_id, activity_update)


@router.delete("/{activity_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_activity(
    trip_id: UUID,
    activity_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Delete an activity from a trip owned by the authenticated user."""
    activity_service.delete_activity(db, trip_id, activity_id, user_id)
    return None
