from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import BookingCreate, BookingResponse, BookingUpdate
from app.services.booking_service import booking_service

router = APIRouter(prefix="/trips/{trip_id}/bookings", tags=["Bookings"])


@router.get("", response_model=List[BookingResponse])
def list_trip_bookings(trip_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)):
    """All bookings of a trip owned by the authenticated user."""
    return booking_service.list_for_trip(db, trip_id, user_id)


@router.post("", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
def create_booking(
    trip_id: UUID,
    data: BookingCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Record a flight, hotel, transportation or activity reservation (optionally linking existing documents)."""
    return booking_service.create(db, trip_id, user_id, data)


@router.get("/{booking_id}", response_model=BookingResponse)
def get_booking(
    trip_id: UUID, booking_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)
):
    return booking_service.get(db, trip_id, booking_id, user_id)


@router.patch("/{booking_id}", response_model=BookingResponse)
def update_booking(
    trip_id: UUID,
    booking_id: UUID,
    data: BookingUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Change only the fields sent. The booking is re-validated as it would be after the change."""
    return booking_service.update(db, trip_id, booking_id, user_id, data)


@router.delete("/{booking_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_booking(
    trip_id: UUID, booking_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)
):
    """Delete a booking. Linked documents are unlinked, never deleted."""
    booking_service.delete(db, trip_id, booking_id, user_id)
    return None
