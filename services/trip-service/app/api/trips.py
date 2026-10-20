from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import TripCreate, TripResponse, TripUpdate
from app.services.trip_service import trip_repository

router = APIRouter(prefix="/trips", tags=["Trips"])


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip(
    trip: TripCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Create a new trip strictly owned by the authenticated user."""
    return trip_repository.create(db, trip, user_id=user_id)


@router.get("", response_model=List[TripResponse])
def get_all_trips(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Retrieve only trips belonging to the authenticated user."""
    return trip_repository.get_all(db, user_id=user_id)


@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Retrieve a single trip owned by the authenticated user."""
    trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )
    return trip


@router.patch("/{trip_id}", response_model=TripResponse)
def update_trip(
    trip_id: UUID,
    trip_update: TripUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Update a trip owned by the authenticated user."""
    try:
        updated_trip = trip_repository.update(db, trip_id, trip_update, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not updated_trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )
    return updated_trip


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Delete a trip owned by the authenticated user."""
    deleted = trip_repository.delete(db, trip_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )
    return None
