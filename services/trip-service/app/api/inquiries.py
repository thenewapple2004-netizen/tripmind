"""Inquiries: the sales pipeline, the travel brief and conversion to a trip."""

from datetime import date
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.customers import no_store
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.crm_schemas import (
    InquiryConvert,
    InquiryCreate,
    InquiryDetail,
    InquiryUpdate,
    PaginatedInquiries,
    StageChange,
)
from app.models.customer import INQUIRY_STAGES
from app.models.schemas import TripResponse
from app.services.inquiry_service import SORTS, inquiry_service

router = APIRouter(prefix="/inquiries", tags=["Inquiries"], dependencies=[Depends(no_store)])


class ConversionResult(BaseModel):
    inquiry: InquiryDetail
    trip: TripResponse


@router.get("", response_model=PaginatedInquiries)
def list_inquiries(
    q: Optional[str] = Query(None, max_length=100, description="Destination or customer name"),
    stage: Optional[Literal[INQUIRY_STAGES]] = None,  # type: ignore[valid-type]
    customer_id: Optional[UUID] = None,
    sort: Literal[SORTS] = "updated_desc",  # type: ignore[valid-type]
    page: int = Query(1, ge=1),
    page_size: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return inquiry_service.list(
        db, user_id, q=q, stage=stage, customer_id=customer_id, sort=sort, page=page, page_size=page_size
    )


@router.post("", response_model=InquiryDetail, status_code=status.HTTP_201_CREATED)
def create_inquiry(
    data: InquiryCreate,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return inquiry_service.create(db, user_id, data, today)


@router.get("/{inquiry_id}", response_model=InquiryDetail)
def get_inquiry(
    inquiry_id: UUID,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return inquiry_service.get(db, user_id, inquiry_id, today)


@router.patch("/{inquiry_id}", response_model=InquiryDetail)
def update_inquiry(
    inquiry_id: UUID,
    data: InquiryUpdate,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Edit the inquiry and, with `brief`, its travel brief. Allowed at every stage."""
    return inquiry_service.update(db, user_id, inquiry_id, data, today)


@router.delete("/{inquiry_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_inquiry(inquiry_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)):
    inquiry_service.delete(db, user_id, inquiry_id)
    return None


@router.post("/{inquiry_id}/stage", response_model=InquiryDetail)
def change_inquiry_stage(
    inquiry_id: UUID,
    data: StageChange,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Move the inquiry along the pipeline. A move the pipeline doesn't allow is a 409 that says where it can go."""
    return inquiry_service.change_stage(db, user_id, inquiry_id, data, today)


@router.post("/{inquiry_id}/convert", response_model=ConversionResult, status_code=status.HTTP_201_CREATED)
def convert_inquiry(
    inquiry_id: UUID,
    data: InquiryConvert,
    today: Optional[date] = None,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Create a new trip from a confirmed inquiry (`confirm` must be true). Converting twice is a 409."""
    inquiry, trip = inquiry_service.convert(db, user_id, inquiry_id, data, today)
    return ConversionResult(inquiry=inquiry, trip=trip)
