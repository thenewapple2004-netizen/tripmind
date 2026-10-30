"""Customers: the owner's directory, the Customer 360 view and the customer's history."""

from datetime import date
from typing import Literal, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.crm_schemas import (
    CustomerCreate,
    CustomerDetail,
    CustomerUpdate,
    EventResponse,
    NoteCreate,
    PaginatedCustomers,
    PaginatedEvents,
)
from app.models.customer import CONTACT_METHODS
from app.services.customer_service import SORTS, customer_service


def no_store(response: Response) -> None:
    """Customer data is personal: keep it out of browser and proxy caches."""
    response.headers["Cache-Control"] = "no-store"


router = APIRouter(prefix="/customers", tags=["Customers"], dependencies=[Depends(no_store)])


@router.get("", response_model=PaginatedCustomers)
def list_customers(
    q: Optional[str] = Query(None, max_length=100, description="Name, email, phone, city or country"),
    status_filter: Literal["active", "archived", "all"] = Query("active", alias="status"),
    has_open_inquiry: Optional[bool] = None,
    has_trips: Optional[bool] = None,
    preferred_contact: Optional[Literal[CONTACT_METHODS]] = None,  # type: ignore[valid-type]
    sort: Literal[SORTS] = "name_asc",  # type: ignore[valid-type]
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return customer_service.list(
        db, user_id, q=q, status_filter=status_filter, has_open_inquiry=has_open_inquiry, has_trips=has_trips,
        preferred_contact=preferred_contact, sort=sort, page=page, page_size=page_size,
    )


@router.post("", response_model=CustomerDetail, status_code=status.HTTP_201_CREATED)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)):
    return customer_service.create(db, user_id, data)


@router.get("/{customer_id}", response_model=CustomerDetail)
def get_customer(
    customer_id: UUID,
    today: Optional[date] = Query(None, description="The caller's calendar date, for follow-up status"),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return customer_service.get(db, user_id, customer_id, today)


@router.patch("/{customer_id}", response_model=CustomerDetail)
def update_customer(
    customer_id: UUID, data: CustomerUpdate, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)
):
    return customer_service.update(db, user_id, customer_id, data)


@router.delete("/{customer_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_customer(customer_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)):
    """Deletes the customer with their inquiries, follow-ups and history. Trips made for them are kept."""
    customer_service.delete(db, user_id, customer_id)
    return None


@router.get("/{customer_id}/events", response_model=PaginatedEvents)
def list_customer_events(
    customer_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(30, ge=1, le=100),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return customer_service.events(db, user_id, customer_id, page=page, page_size=page_size)


@router.post("/{customer_id}/notes", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def add_customer_note(
    customer_id: UUID, data: NoteCreate, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)
):
    """Adds a note (a call, a conversation) to the customer's history."""
    return customer_service.add_note(db, user_id, customer_id, data)
