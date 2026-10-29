"""
owner.py
========
API endpoints for the TripMind Owner Portal:
- GET /api/v1/owner/dashboard: Comprehensive aggregated overview of trips, budgets, expenses, activities, and reports
- GET /api/v1/owner/activities: Paginated activities across all trips belonging to the authenticated owner
- GET /api/v1/owner/expenses: Paginated expenses across all trips belonging to the authenticated owner
- GET /api/v1/owner/reports: History of generated reports for the authenticated owner's trips
"""

import logging
from datetime import date
from typing import List, Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import (
    BookingSummary,
    DocumentResponse,
    LinkedBooking,
    PaginatedOwnerBookings,
    OwnerDocumentItem,
    OwnerDashboardResponse,
    OwnerReportHistoryItem,
    PaginatedOwnerActivities,
    PaginatedOwnerExpenses,
)
from app.services.booking_service import booking_service
from app.services.document_service import document_service
from app.services.owner_dashboard_service import owner_dashboard_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/owner", tags=["Owner Dashboard"])


@router.get("/dashboard", response_model=OwnerDashboardResponse)
def get_owner_dashboard(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Retrieve comprehensive aggregated statistics, charts, upcoming trips,
    recent activities, and expense breakdown for the authenticated trip owner.
    """
    return owner_dashboard_service.get_owner_dashboard(db, user_id)


@router.get("/activities", response_model=PaginatedOwnerActivities)
def get_owner_activities(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Retrieve a paginated list of all activities scheduled across all trips owned by the user.
    """
    return owner_dashboard_service.get_paginated_activities(
        db, user_id, page=page, page_size=page_size
    )


@router.get("/expenses", response_model=PaginatedOwnerExpenses)
def get_owner_expenses(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=50, description="Items per page"),
    category: Optional[str] = Query(None, description="Optional category filter"),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Retrieve a paginated list of all expenses incurred across all trips owned by the user.
    """
    return owner_dashboard_service.get_paginated_expenses(
        db, user_id, page=page, page_size=page_size, category=category
    )


@router.get("/reports", response_model=List[OwnerReportHistoryItem])
def get_owner_reports(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """
    Retrieve report generation history for all trips owned by the user.
    """
    dashboard = owner_dashboard_service.get_owner_dashboard(db, user_id)
    return dashboard.reports_history


@router.get("/documents", response_model=List[OwnerDocumentItem])
def get_owner_documents(
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Every travel document across the authenticated owner's trips (metadata only)."""
    return [
        OwnerDocumentItem(
            **DocumentResponse.model_validate(doc).model_dump(),
            trip_title=title,
            bookings=[LinkedBooking.model_validate(b) for b in sorted(doc.bookings, key=lambda b: (b.start_date, b.title))],
        )
        for doc, title in document_service.list_for_owner(db, user_id)
    ]


@router.get("/bookings", response_model=PaginatedOwnerBookings)
def get_owner_bookings(
    q: Optional[str] = Query(None, max_length=100, description="Search title, provider, confirmation number, location or trip"),
    type: Optional[Literal["flight", "hotel", "transportation", "activity"]] = Query(None),
    status: Optional[Literal["pending", "confirmed", "cancelled", "completed"]] = Query(None),
    trip_id: Optional[UUID] = Query(None),
    scope: Literal["upcoming", "past", "all"] = Query("all", description="upcoming: not over and pending/confirmed; past: over or completed"),
    sort: Literal["start_asc", "start_desc", "cost_desc", "cost_asc", "created_desc", "title_asc"] = Query("start_asc"),
    today: Optional[date] = Query(None, description="The caller's local date, so 'upcoming' matches their calendar"),
    page: int = Query(1, ge=1),
    page_size: int = Query(12, ge=1, le=50),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Bookings across all of the owner's trips, with search, filters, sorting and pagination."""
    return booking_service.list_for_owner(
        db, user_id, q=q, type=type, status_filter=status, trip_id=trip_id, scope=scope,
        sort=sort, today=today, page=page, page_size=page_size,
    )


@router.get("/bookings/summary", response_model=BookingSummary)
def get_owner_booking_summary(
    today: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Counts by status and type, and the cost of what is coming up (per currency)."""
    return booking_service.summary(db, user_id, today)
