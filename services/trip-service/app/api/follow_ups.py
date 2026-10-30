"""Follow-ups: reminders linked to a customer or an inquiry."""

from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.api.customers import no_store
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.crm_schemas import (
    FollowUpCreate,
    FollowUpResponse,
    FollowUpSummary,
    FollowUpUpdate,
    FollowUpView,
    PaginatedFollowUps,
)
from app.services.follow_up_service import follow_up_service

router = APIRouter(prefix="/follow-ups", tags=["Follow-ups"], dependencies=[Depends(no_store)])


@router.get("", response_model=PaginatedFollowUps)
def list_follow_ups(
    view: FollowUpView = "open",
    today: Optional[date] = Query(None, description="The caller's calendar date; defaults to the server's"),
    customer_id: Optional[UUID] = None,
    inquiry_id: Optional[UUID] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return follow_up_service.list(
        db, user_id, view=view, today=today, customer_id=customer_id, inquiry_id=inquiry_id, page=page, page_size=page_size
    )


@router.get("/summary", response_model=FollowUpSummary)
def follow_up_summary(
    today: Optional[date] = None, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)
):
    """How many open follow-ups are overdue, due today and still ahead."""
    return follow_up_service.summary(db, user_id, today)


@router.post("", response_model=FollowUpResponse, status_code=status.HTTP_201_CREATED)
def create_follow_up(
    data: FollowUpCreate,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return follow_up_service.create(db, user_id, data, today)


@router.patch("/{follow_up_id}", response_model=FollowUpResponse)
def update_follow_up(
    follow_up_id: UUID,
    data: FollowUpUpdate,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Edit a follow-up, or complete / reopen it with `completed`."""
    return follow_up_service.update(db, user_id, follow_up_id, data, today)


@router.delete("/{follow_up_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_follow_up(follow_up_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)):
    follow_up_service.delete(db, user_id, follow_up_id)
    return None
