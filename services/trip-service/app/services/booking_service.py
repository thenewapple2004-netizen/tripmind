import math
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List, Optional, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from fastapi.exceptions import RequestValidationError
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.models.booking import Booking
from app.models.document import TripDocument
from app.models.schemas import (
    BookingCostTotal,
    BookingCreate,
    BookingResponse,
    BookingSummary,
    BookingUpdate,
    OwnerBookingItem,
    PaginatedOwnerBookings,
    BOOKING_STATUSES,
    BOOKING_TYPES,
)
from app.models.trip import Trip
from app.services.booking_rules import validate_booking
from app.services.trip_service import trip_repository

SORTS = ("start_asc", "start_desc", "cost_desc", "cost_asc", "created_desc", "title_asc")
SCOPES = ("upcoming", "past", "all")

# The fields `validate_booking` and an update work on.
_FIELDS = (
    "type", "status", "title", "provider", "confirmation_number", "start_date", "start_time",
    "end_date", "end_time", "location", "total_cost", "currency", "notes", "cancellation_policy",
    "free_cancellation_until", "details",
)


def _money(value) -> Decimal:
    return Decimal(str(value)).quantize(Decimal("0.01"))


def _like(term: str) -> str:
    """A LIKE pattern that treats the user's text literally (no accidental % or _ wildcards)."""
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


class BookingService:
    # ── helpers ──────────────────────────────────────────────────────────

    def _trip(self, db: Session, trip_id: UUID, user_id: UUID) -> Trip:
        # 404 rather than 403 for someone else's trip, so ids can't be probed.
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with id '{trip_id}' not found or you do not have permission",
            )
        return trip

    def _get(self, db: Session, trip_id: UUID, booking_id: UUID) -> Booking:
        booking = db.query(Booking).filter(Booking.id == booking_id, Booking.trip_id == trip_id).first()
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Booking with id '{booking_id}' not found for this trip",
            )
        return booking

    @staticmethod
    def _outside_trip(booking: Booking, trip: Trip) -> bool:
        last = booking.end_date or booking.start_date
        return booking.start_date < trip.start_date or last > trip.end_date

    def to_response(self, booking: Booking, trip: Trip) -> BookingResponse:
        response = BookingResponse.model_validate(booking)
        response.outside_trip_dates = self._outside_trip(booking, trip)
        return response

    @staticmethod
    def _raise(errors: Sequence[tuple]) -> None:
        raise RequestValidationError(
            [{"type": "value_error", "loc": ("body", field), "msg": message, "input": None} for field, message in errors]
        )

    def _documents(self, db: Session, trip_id: UUID, ids: Sequence[UUID]) -> List[TripDocument]:
        """The documents to link. They must already exist *on this trip*, so a booking can never reach
        a file that belongs to another trip or another owner. Nothing is copied."""
        wanted = list(dict.fromkeys(ids))
        if not wanted:
            return []
        found = db.query(TripDocument).filter(TripDocument.trip_id == trip_id, TripDocument.id.in_(wanted)).all()
        missing = set(wanted) - {d.id for d in found}
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Document '{sorted(map(str, missing))[0]}' not found for this trip",
            )
        by_id = {d.id: d for d in found}
        return [by_id[i] for i in wanted]  # keep the order the owner chose

    @staticmethod
    def _fields_of(booking: Booking) -> Dict[str, Any]:
        return {name: getattr(booking, name) for name in _FIELDS}

    # ── trip-scoped CRUD ─────────────────────────────────────────────────

    def list_for_trip(self, db: Session, trip_id: UUID, user_id: UUID) -> List[BookingResponse]:
        trip = self._trip(db, trip_id, user_id)
        rows = (
            db.query(Booking)
            .options(selectinload(Booking.documents))
            .filter(Booking.trip_id == trip_id)
            .order_by(Booking.start_date.asc(), Booking.start_time.asc(), Booking.created_at.asc())
            .all()
        )
        return [self.to_response(b, trip) for b in rows]

    def get(self, db: Session, trip_id: UUID, booking_id: UUID, user_id: UUID) -> BookingResponse:
        trip = self._trip(db, trip_id, user_id)
        return self.to_response(self._get(db, trip_id, booking_id), trip)

    def create(self, db: Session, trip_id: UUID, user_id: UUID, data: BookingCreate) -> BookingResponse:
        trip = self._trip(db, trip_id, user_id)
        fields = data.model_dump(exclude={"document_ids"})
        fields["details"], errors = validate_booking(fields)
        if errors:
            self._raise(errors)
        documents = self._documents(db, trip_id, data.document_ids)

        fields["total_cost"] = _money(fields["total_cost"])
        booking = Booking(trip_id=trip_id, **fields)
        booking.documents = documents
        db.add(booking)
        db.commit()
        db.refresh(booking)
        return self.to_response(booking, trip)

    def update(
        self, db: Session, trip_id: UUID, booking_id: UUID, user_id: UUID, data: BookingUpdate
    ) -> BookingResponse:
        trip = self._trip(db, trip_id, user_id)
        booking = self._get(db, trip_id, booking_id)

        changes = data.model_dump(exclude_unset=True)
        document_ids = changes.pop("document_ids", None)

        # Validate the booking as it WOULD be after the change, so a partial update can't leave it
        # inconsistent (for example, switching type without supplying that type's details).
        merged = self._fields_of(booking)
        merged.update(changes)
        merged["details"], errors = validate_booking(merged)
        if errors:
            self._raise(errors)
        documents = self._documents(db, trip_id, document_ids) if document_ids is not None else None

        for name in _FIELDS:
            value = merged[name]
            setattr(booking, name, _money(value) if name == "total_cost" else value)
        if documents is not None:
            booking.documents = documents
        db.commit()
        db.refresh(booking)
        return self.to_response(booking, trip)

    def delete(self, db: Session, trip_id: UUID, booking_id: UUID, user_id: UUID) -> None:
        self._trip(db, trip_id, user_id)
        booking = self._get(db, trip_id, booking_id)
        db.delete(booking)  # removes the booking and its links; the documents themselves stay
        db.commit()

    # ── owner-wide ───────────────────────────────────────────────────────

    @staticmethod
    def _scope_filter(scope: str, today: date):
        last_day = func.coalesce(Booking.end_date, Booking.start_date)
        if scope == "upcoming":
            return (last_day >= today) & Booking.status.in_(("pending", "confirmed"))
        if scope == "past":
            return (last_day < today) | (Booking.status == "completed")
        return None

    def list_for_owner(
        self,
        db: Session,
        user_id: UUID,
        *,
        q: Optional[str] = None,
        type: Optional[str] = None,
        status_filter: Optional[str] = None,
        trip_id: Optional[UUID] = None,
        scope: str = "all",
        sort: str = "start_asc",
        today: Optional[date] = None,
        page: int = 1,
        page_size: int = 12,
    ) -> PaginatedOwnerBookings:
        today = today or date.today()
        query = (
            db.query(Booking, Trip)
            .join(Trip, Booking.trip_id == Trip.id)
            .options(selectinload(Booking.documents))
            .filter(Trip.user_id == user_id)
        )
        if type:
            query = query.filter(Booking.type == type)
        if status_filter:
            query = query.filter(Booking.status == status_filter)
        if trip_id:
            query = query.filter(Booking.trip_id == trip_id)
        scope_clause = self._scope_filter(scope, today)
        if scope_clause is not None:
            query = query.filter(scope_clause)
        if q and q.strip():
            pattern = _like(q.strip().lower())
            query = query.filter(
                or_(*(func.lower(col).like(pattern, escape="\\") for col in (
                    Booking.title, Booking.provider, Booking.confirmation_number, Booking.location,
                    Trip.title, Trip.destination,
                )))
            )

        order = {
            "start_asc": (Booking.start_date.asc(), Booking.start_time.asc(), Booking.created_at.asc()),
            "start_desc": (Booking.start_date.desc(), Booking.start_time.desc(), Booking.created_at.desc()),
            "cost_desc": (Booking.total_cost.desc(), Booking.start_date.asc()),
            "cost_asc": (Booking.total_cost.asc(), Booking.start_date.asc()),
            "created_desc": (Booking.created_at.desc(),),
            "title_asc": (func.lower(Booking.title).asc(), Booking.start_date.asc()),
        }[sort]

        total = query.count()
        rows = query.order_by(*order, Booking.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
        items = []
        for booking, trip in rows:
            base = self.to_response(booking, trip)
            items.append(OwnerBookingItem(**base.model_dump(), trip_title=trip.title, trip_destination=trip.destination))
        return PaginatedOwnerBookings(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, math.ceil(total / page_size)),
        )

    def summary(self, db: Session, user_id: UUID, today: Optional[date] = None) -> BookingSummary:
        today = today or date.today()
        mine = db.query(Booking).join(Trip, Booking.trip_id == Trip.id).filter(Trip.user_id == user_id)

        by_status = {s: 0 for s in BOOKING_STATUSES}
        for key, count in mine.with_entities(Booking.status, func.count(Booking.id)).group_by(Booking.status).all():
            by_status[key] = count
        by_type = {t: 0 for t in BOOKING_TYPES}
        for key, count in mine.with_entities(Booking.type, func.count(Booking.id)).group_by(Booking.type).all():
            by_type[key] = count

        trip_count = mine.with_entities(func.count(func.distinct(Booking.trip_id))).scalar() or 0
        upcoming = mine.filter(self._scope_filter("upcoming", today))
        costs = (
            upcoming.with_entities(Booking.currency, func.sum(Booking.total_cost))
            .group_by(Booking.currency)
            .order_by(Booking.currency)
            .all()
        )
        return BookingSummary(
            total=sum(by_status.values()),
            trip_count=trip_count,
            upcoming_count=upcoming.count(),
            by_status=by_status,
            by_type=by_type,
            upcoming_cost=[BookingCostTotal(currency=c, total=float(t or 0)) for c, t in costs],
        )

    # ── itinerary ────────────────────────────────────────────────────────

    def for_itinerary(self, db: Session, trip_id: UUID) -> List[Booking]:
        """Bookings that can appear on the itinerary. The caller has already verified trip ownership."""
        return db.query(Booking).filter(Booking.trip_id == trip_id, Booking.status.in_(("confirmed", "completed"))).all()


booking_service = BookingService()
