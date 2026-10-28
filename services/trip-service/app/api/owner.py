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
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import (
    DocumentResponse,
    OwnerDocumentItem,
    OwnerDashboardResponse,
    OwnerReportHistoryItem,
    PaginatedOwnerActivities,
    PaginatedOwnerExpenses,
)
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
        OwnerDocumentItem(**DocumentResponse.model_validate(doc).model_dump(), trip_title=title)
        for doc, title in document_service.list_for_owner(db, user_id)
    ]
