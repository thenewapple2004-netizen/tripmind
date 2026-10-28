from uuid import UUID
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import ArrangeRequest, ItineraryResponse
from app.services.activity_service import activity_service

router = APIRouter(prefix="/trips/{trip_id}", tags=["Itinerary"])


@router.get("/itinerary", response_model=ItineraryResponse)
def get_itinerary(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Day-by-day itinerary for a trip, with scheduling conflicts (overlapping timed activities)."""
    return activity_service.get_itinerary(db, trip_id, user_id)


@router.put("/activities/arrange", response_model=ItineraryResponse)
def arrange_activities(
    trip_id: UUID,
    request: ArrangeRequest,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Move activities between days and reorder them, in one atomic request (drag and drop)."""
    return activity_service.arrange(db, trip_id, user_id, request)
