from typing import List
from uuid import UUID
from fastapi import APIRouter, HTTPException, status
from app.models.schemas import TripCreate, TripResponse, TripUpdate
from app.services.trip_service import trip_storage

router = APIRouter(prefix="/trips", tags=["Trips"])


@router.post("", response_model=TripResponse, status_code=status.HTTP_201_CREATED)
def create_trip(trip: TripCreate):
    return trip_storage.create(trip)


@router.get("", response_model=List[TripResponse])
def get_all_trips():
    return trip_storage.get_all()


@router.get("/{trip_id}", response_model=TripResponse)
def get_trip(trip_id: UUID):
    trip = trip_storage.get_by_id(trip_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found"
        )
    return trip


@router.patch("/{trip_id}", response_model=TripResponse)
def update_trip(trip_id: UUID, trip_update: TripUpdate):
    try:
        updated_trip = trip_storage.update(trip_id, trip_update)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not updated_trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found"
        )
    return updated_trip


@router.delete("/{trip_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_trip(trip_id: UUID):
    deleted = trip_storage.delete(trip_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found"
        )
    return None
