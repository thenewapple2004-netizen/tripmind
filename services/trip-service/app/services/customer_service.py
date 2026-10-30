"""
Customers: the people the owner organises trips for. They are records, not accounts.

Every operation is scoped to the owner (`user_id`); someone else's customer is a 404. Contact details are only
returned to the owner, are never written to the history, and are never logged.
"""

import math
from datetime import date
from typing import Optional
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import case, func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.booking import Booking
from app.models.crm_schemas import (
    CustomerBookingItem,
    CustomerCreate,
    CustomerDetail,
    CustomerSummary,
    CustomerTripItem,
    CustomerUpdate,
    EventResponse,
    NoteCreate,
    PaginatedCustomers,
    PaginatedEvents,
)
from app.models.customer import OPEN_STAGES, Customer, CustomerEvent, FollowUp, Inquiry
from app.models.trip import Trip
from app.services.crm_common import get_customer, like, names, raise_fields, record_event
from app.services.follow_up_service import follow_up_service
from app.services.inquiry_service import inquiry_service

SORTS = ("name_asc", "name_desc", "newest", "activity_desc", "inquiries_desc")
_DUPLICATE_EMAIL = "You already have a customer with this email address"
_CONTACT_FIELDS = ("name", "email", "phone", "city", "country", "preferred_contact", "preferences", "notes")


class CustomerService:
    def _check_email_free(self, db: Session, user_id: UUID, email: Optional[str], *, exclude: Optional[UUID] = None) -> None:
        if not email:
            return
        query = db.query(Customer.id).filter(Customer.user_id == user_id, Customer.email == email)
        if exclude:
            query = query.filter(Customer.id != exclude)
        if query.first():
            raise_fields([("email", _DUPLICATE_EMAIL)])

    # ── directory ────────────────────────────────────────────────────────

    def list(
        self,
        db: Session,
        user_id: UUID,
        *,
        q: Optional[str] = None,
        status_filter: str = "active",
        has_open_inquiry: Optional[bool] = None,
        has_trips: Optional[bool] = None,
        preferred_contact: Optional[str] = None,
        sort: str = "name_asc",
        page: int = 1,
        page_size: int = 20,
    ) -> PaginatedCustomers:
        inquiry_counts = (
            db.query(
                Inquiry.customer_id.label("customer_id"),
                func.count(Inquiry.id).label("total"),
                func.sum(case((Inquiry.stage.in_(OPEN_STAGES), 1), else_=0)).label("open"),
            )
            .filter(Inquiry.user_id == user_id)
            .group_by(Inquiry.customer_id)
            .subquery()
        )
        trip_counts = (
            db.query(Trip.customer_id.label("customer_id"), func.count(Trip.id).label("trips"))
            .filter(Trip.user_id == user_id, Trip.customer_id.is_not(None))
            .group_by(Trip.customer_id)
            .subquery()
        )
        next_follow_up = (
            db.query(FollowUp.customer_id.label("customer_id"), func.min(FollowUp.due_date).label("due"))
            .filter(FollowUp.user_id == user_id, FollowUp.completed_at.is_(None))
            .group_by(FollowUp.customer_id)
            .subquery()
        )
        total_inquiries = func.coalesce(inquiry_counts.c.total, 0)
        open_inquiries = func.coalesce(inquiry_counts.c.open, 0)
        trip_count = func.coalesce(trip_counts.c.trips, 0)

        query = (
            db.query(Customer, total_inquiries, open_inquiries, trip_count, next_follow_up.c.due)
            .outerjoin(inquiry_counts, inquiry_counts.c.customer_id == Customer.id)
            .outerjoin(trip_counts, trip_counts.c.customer_id == Customer.id)
            .outerjoin(next_follow_up, next_follow_up.c.customer_id == Customer.id)
            .filter(Customer.user_id == user_id)
        )
        if status_filter == "active":
            query = query.filter(Customer.is_archived.is_(False))
        elif status_filter == "archived":
            query = query.filter(Customer.is_archived.is_(True))
        if has_open_inquiry is not None:
            query = query.filter(open_inquiries > 0 if has_open_inquiry else open_inquiries == 0)
        if has_trips is not None:
            query = query.filter(trip_count > 0 if has_trips else trip_count == 0)
        if preferred_contact:
            query = query.filter(Customer.preferred_contact == preferred_contact)
        if q and q.strip():
            pattern = like(q.strip())
            query = query.filter(
                or_(
                    *(
                        column.ilike(pattern, escape="\\")
                        for column in (Customer.name, Customer.email, Customer.phone, Customer.city, Customer.country)
                    )
                )
            )

        total = query.count()
        order = {
            "name_asc": (func.lower(Customer.name).asc(),),
            "name_desc": (func.lower(Customer.name).desc(),),
            "newest": (Customer.created_at.desc(),),
            "activity_desc": (Customer.last_activity_at.desc(),),
            "inquiries_desc": (open_inquiries.desc(), total_inquiries.desc()),
        }.get(sort, (func.lower(Customer.name).asc(),))
        rows = query.order_by(*order, Customer.id.asc()).offset((page - 1) * page_size).limit(page_size).all()

        items = [
            CustomerSummary.model_validate(customer).model_copy(
                update={
                    "total_inquiries": int(total_n or 0),
                    "open_inquiries": int(open_n or 0),
                    "trip_count": int(trips_n or 0),
                    "next_follow_up_on": due,
                }
            )
            for customer, total_n, open_n, trips_n, due in rows
        ]
        return PaginatedCustomers(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    # ── one customer ─────────────────────────────────────────────────────

    def get(self, db: Session, user_id: UUID, customer_id: UUID, today: Optional[date] = None) -> CustomerDetail:
        """Customer 360: the profile with every inquiry, trip, booking and follow-up that belongs to them."""
        customer = get_customer(db, customer_id, user_id)

        trips = (
            db.query(Trip)
            .filter(Trip.customer_id == customer.id, Trip.user_id == user_id)
            .order_by(Trip.start_date.desc(), Trip.id.asc())
            .all()
        )
        trip_ids = [t.id for t in trips]
        booking_rows = (
            db.query(Booking).filter(Booking.trip_id.in_(trip_ids)).order_by(Booking.start_date.asc(), Booking.id.asc()).all()
            if trip_ids
            else []
        )
        booking_counts: dict = {}
        for booking in booking_rows:
            booking_counts[booking.trip_id] = booking_counts.get(booking.trip_id, 0) + 1
        trip_titles = {t.id: t.title for t in trips}
        source_inquiry = {
            i.converted_trip_id: i.id
            for i in db.query(Inquiry.id, Inquiry.converted_trip_id).filter(
                Inquiry.customer_id == customer.id, Inquiry.converted_trip_id.is_not(None)
            )
        }

        return CustomerDetail(
            id=customer.id,
            name=customer.name,
            email=customer.email,
            phone=customer.phone,
            city=customer.city,
            country=customer.country,
            preferred_contact=customer.preferred_contact,
            preferences=customer.preferences,
            notes=customer.notes,
            is_archived=customer.is_archived,
            created_at=customer.created_at,
            updated_at=customer.updated_at,
            last_activity_at=customer.last_activity_at,
            inquiries=inquiry_service.for_customer(db, customer.id, user_id),
            trips=[
                CustomerTripItem(
                    id=t.id,
                    title=t.title,
                    destination=t.destination,
                    start_date=t.start_date,
                    end_date=t.end_date,
                    budget=float(t.budget),
                    booking_count=booking_counts.get(t.id, 0),
                    inquiry_id=source_inquiry.get(t.id),
                )
                for t in trips
            ],
            bookings=[
                CustomerBookingItem(
                    id=b.id,
                    trip_id=b.trip_id,
                    trip_title=trip_titles[b.trip_id],
                    type=b.type,
                    title=b.title,
                    status=b.status,
                    start_date=b.start_date,
                    total_cost=float(b.total_cost),
                    currency=b.currency,
                )
                for b in booking_rows[:100]
            ],
            follow_ups=follow_up_service.list(
                db, user_id, view="all", today=today, customer_id=customer.id, page_size=100
            ).items,
        )

    def create(self, db: Session, user_id: UUID, data: CustomerCreate) -> CustomerDetail:
        self._check_email_free(db, user_id, data.email)
        customer = Customer(user_id=user_id, **data.model_dump())
        db.add(customer)
        db.flush()
        record_event(db, customer, "customer_created", "Added to your customers")
        try:
            db.commit()
        except IntegrityError:  # two requests with the same email at once
            db.rollback()
            raise_fields([("email", _DUPLICATE_EMAIL)])
        return self.get(db, user_id, customer.id)

    def update(self, db: Session, user_id: UUID, customer_id: UUID, data: CustomerUpdate) -> CustomerDetail:
        customer = get_customer(db, customer_id, user_id)
        changes = data.model_dump(exclude_unset=True)
        archived = changes.pop("is_archived", None)

        email = changes.get("email", customer.email)
        phone = changes.get("phone", customer.phone)
        if not email and not phone:
            raise_fields([("email", "Keep an email address or a phone number so you can reach this customer")])
        if "email" in changes and changes["email"] != customer.email:
            self._check_email_free(db, user_id, changes["email"], exclude=customer.id)

        edited = [name for name in _CONTACT_FIELDS if name in changes and changes[name] != getattr(customer, name)]
        for name in edited:
            setattr(customer, name, changes[name])
        if edited:
            # Field names only: the history must not copy a phone number or an email address.
            record_event(db, customer, "customer_updated", f"Updated profile: {names(edited)}")
        if archived is not None and archived != customer.is_archived:
            customer.is_archived = archived
            record_event(
                db, customer, "customer_archived" if archived else "customer_restored",
                "Archived this customer" if archived else "Restored this customer",
            )
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            raise_fields([("email", _DUPLICATE_EMAIL)])
        return self.get(db, user_id, customer.id)

    def delete(self, db: Session, user_id: UUID, customer_id: UUID) -> None:
        """Removes the customer with their inquiries, follow-ups and history. Trips made for them are kept:
        they are the owner's trips, and only lose the link."""
        customer = get_customer(db, customer_id, user_id)
        db.query(Trip).filter(Trip.customer_id == customer.id).update({Trip.customer_id: None}, synchronize_session=False)
        db.query(CustomerEvent).filter(CustomerEvent.customer_id == customer.id).delete(synchronize_session=False)
        db.query(FollowUp).filter(FollowUp.customer_id == customer.id).delete(synchronize_session=False)
        db.query(Inquiry).filter(Inquiry.customer_id == customer.id).delete(synchronize_session=False)
        db.delete(customer)
        db.commit()

    # ── history ──────────────────────────────────────────────────────────

    def events(
        self, db: Session, user_id: UUID, customer_id: UUID, *, page: int = 1, page_size: int = 30
    ) -> PaginatedEvents:
        get_customer(db, customer_id, user_id)
        query = db.query(CustomerEvent).filter(CustomerEvent.customer_id == customer_id, CustomerEvent.user_id == user_id)
        total = query.count()
        rows = (
            query.order_by(CustomerEvent.created_at.desc(), CustomerEvent.id.asc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )
        return PaginatedEvents(
            items=[EventResponse.model_validate(e) for e in rows],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    def add_note(self, db: Session, user_id: UUID, customer_id: UUID, data: NoteCreate) -> EventResponse:
        customer = get_customer(db, customer_id, user_id)
        if data.inquiry_id:
            owned = db.query(Inquiry.id).filter(
                Inquiry.id == data.inquiry_id, Inquiry.user_id == user_id, Inquiry.customer_id == customer.id
            ).first()
            if not owned:
                raise_fields([("inquiry_id", "Inquiry not found")])
        event = record_event(db, customer, "note", data.summary, inquiry_id=data.inquiry_id)
        db.commit()
        db.refresh(event)
        return EventResponse.model_validate(event)


customer_service = CustomerService()
