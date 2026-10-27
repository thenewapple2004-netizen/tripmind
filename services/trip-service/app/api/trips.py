from datetime import date
from typing import List, Optional, Union
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.core.auth_service_client import (
    get_owner_profile,
    AuthServiceAuthError,
    AuthServiceUnavailableError,
    AuthServiceError,
)
from app.models.schemas import (
    OwnerProfileResponse,
    PaginatedTripResponse,
    TripCreate,
    TripResponse,
    TripUpdate,
)
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


@router.get("", response_model=Union[PaginatedTripResponse, List[TripResponse]])
def get_all_trips(
    response: Response,
    search: Optional[str] = Query(None, description="Search across title and destination"),
    status: Optional[str] = Query(None, description="Status filter: upcoming, ongoing, completed, all"),
    sort_by: Optional[str] = Query(None, description="Sort field: start_date, budget, title, newest, upcoming"),
    order: Optional[str] = Query("asc", description="Sort direction: asc or desc"),
    page: Optional[int] = Query(None, ge=1, description="Page number (1-indexed)"),
    page_size: Optional[int] = Query(None, ge=1, le=100, description="Items per page"),
    min_budget: Optional[float] = Query(None, ge=0, description="Minimum budget filter"),
    max_budget: Optional[float] = Query(None, ge=0, description="Maximum budget filter"),
    start_date_from: Optional[date] = Query(None, description="Earliest trip start date"),
    start_date_to: Optional[date] = Query(None, description="Latest trip start date"),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Retrieve user trips with server-side search, filtering, sorting, and pagination."""
    # If any search, filter, sort, or pagination parameter is specified, use get_paginated
    is_filtered_or_paged = any(
        v is not None
        for v in (search, status, sort_by, page, page_size, min_budget, max_budget, start_date_from, start_date_to)
    )

    if is_filtered_or_paged:
        p = page if page is not None else 1
        ps = page_size if page_size is not None else 10
        items, total, total_pages = trip_repository.get_paginated(
            db,
            user_id=user_id,
            search=search,
            status=status,
            sort_by=sort_by,
            order=order,
            page=p,
            page_size=ps,
            min_budget=min_budget,
            max_budget=max_budget,
            start_date_from=start_date_from,
            start_date_to=start_date_to,
        )
        response.headers["X-Total-Count"] = str(total)
        # If pagination was explicitly requested via page or page_size, return paginated envelope
        if page is not None or page_size is not None:
            return PaginatedTripResponse(
                items=items,
                total=total,
                page=p,
                page_size=ps,
                total_pages=total_pages,
            )
        return items

    trips = trip_repository.get_all(db, user_id=user_id)
    response.headers["X-Total-Count"] = str(len(trips))
    return trips


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


@router.get("/{trip_id}/owner-profile", response_model=OwnerProfileResponse)
async def get_trip_owner_profile(
    trip_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Fetch the authenticated owner's profile from the Auth Service.

    Flow:
      1. Validate the JWT and extract user_id (via ``get_current_user_id``).
      2. Confirm the trip exists **and** is owned by this user (ownership check
         against PostgreSQL — Trip Service never reads Auth Service's DB).
      3. Forward the caller's Bearer token to Auth Service ``GET /api/v1/auth/me``
         using an HTTPX async client with retries and exponential back-off.
      4. Return the profile enriched with a ``source`` field so the UI can
         display which service provided the data.
    """
    # Step 1+2 — ownership verification via PostgreSQL
    trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
    if not trip:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )

    # Step 3 — extract the raw Bearer token from the incoming request
    auth_header = request.headers.get("Authorization", "")
    bearer_token = auth_header.removeprefix("Bearer ").strip()
    if not bearer_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    # Step 4 — call Auth Service
    try:
        profile = await get_owner_profile(bearer_token)
    except AuthServiceAuthError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )
    except AuthServiceUnavailableError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )
    except AuthServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        )

    return OwnerProfileResponse(
        id=profile["id"],
        email=profile["email"],
        created_at=profile["created_at"],
        source="auth-service",
    )
