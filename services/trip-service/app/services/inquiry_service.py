"""
Inquiries: a customer's request for a trip, moving through the sales pipeline.

Every operation is scoped to the owner (`user_id`); someone else's inquiry is a 404. Stage changes are checked
against `crm_rules` and written to the customer's history. A confirmed inquiry can be converted into a trip
through the existing TripRepository; the inquiry itself is kept and linked to the new trip.
"""

import math
from datetime import date
from decimal import Decimal
from typing import Dict, List, Optional, Sequence, Tuple
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core import cache
from app.core.cache import get_owner_dashboard_cache_key
from app.models.crm_schemas import (
    CustomerRef,
    EventResponse,
    InquiryConvert,
    InquiryCreate,
    InquiryDetail,
    InquiryListItem,
    InquiryUpdate,
    PaginatedInquiries,
    StageChange,
    TravelBrief,
)
from app.models.customer import Customer, CustomerEvent, FollowUp, Inquiry
from app.models.schemas import TripCreate, TripResponse
from app.services.crm_common import get_customer, like, names, now, raise_fields, record_event
from app.services.crm_rules import STAGE_LABELS, allowed_next, can_move
from app.services.follow_up_service import follow_up_service
from app.services.trip_service import trip_repository

SORTS = ("updated_desc", "created_desc", "destination_asc", "budget_desc", "start_asc")

# The inquiry columns an owner can edit, in the order a history line lists them.
_EDITABLE = (
    "destination", "date_from", "date_to", "travelers", "budget_min", "budget_max", "currency", "source", "notes",
)
_MONEY = ("budget_min", "budget_max")


def _decimal(value) -> Optional[Decimal]:
    return None if value is None else Decimal(str(value)).quantize(Decimal("0.01"))


def _same(column: str, current, new) -> bool:
    if column in _MONEY:
        return _decimal(current) == _decimal(new)
    return current == new


class InquiryService:
    # ── lookups ──────────────────────────────────────────────────────────

    def _get(self, db: Session, inquiry_id: UUID, user_id: UUID, *, lock: bool = False) -> Inquiry:
        query = db.query(Inquiry).filter(Inquiry.id == inquiry_id, Inquiry.user_id == user_id)
        if lock:
            query = query.with_for_update()  # a no-op on SQLite; on Postgres it serialises two conversions
        inquiry = query.first()
        if not inquiry:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Inquiry not found")
        return inquiry

    def to_items(self, db: Session, inquiries: Sequence[Inquiry]) -> List[InquiryListItem]:
        """The customer's name and the follow-up facts (how many are open, which is next), looked up once."""
        ids = [i.id for i in inquiries]
        customer_ids = {i.customer_id for i in inquiries}
        customer_names: Dict[UUID, str] = (
            dict(db.query(Customer.id, Customer.name).filter(Customer.id.in_(customer_ids)).all()) if customer_ids else {}
        )
        follow: Dict[UUID, Tuple[int, date]] = {}
        if ids:
            rows = (
                db.query(FollowUp.inquiry_id, func.count(FollowUp.id), func.min(FollowUp.due_date))
                .filter(FollowUp.inquiry_id.in_(ids), FollowUp.completed_at.is_(None))
                .group_by(FollowUp.inquiry_id)
                .all()
            )
            follow = {inquiry_id: (count, due) for inquiry_id, count, due in rows}

        items = []
        for i in inquiries:
            count, due = follow.get(i.id, (0, None))
            items.append(
                InquiryListItem(
                    id=i.id,
                    customer=CustomerRef(id=i.customer_id, name=customer_names.get(i.customer_id, "")),
                    destination=i.destination,
                    date_from=i.date_from,
                    date_to=i.date_to,
                    travelers=i.travelers,
                    budget_min=float(i.budget_min) if i.budget_min is not None else None,
                    budget_max=float(i.budget_max) if i.budget_max is not None else None,
                    currency=i.currency,
                    source=i.source,
                    notes=i.notes,
                    stage=i.stage,
                    stage_changed_at=i.stage_changed_at,
                    closed_reason=i.closed_reason,
                    brief=TravelBrief.model_validate(i.brief or {}),
                    next_follow_up_on=due,
                    open_follow_ups=count,
                    # A converted inquiry is final: it records the trip it became.
                    allowed_stages=[] if i.converted_trip_id else allowed_next(i.stage),
                    converted_trip_id=i.converted_trip_id,
                    converted_at=i.converted_at,
                    created_at=i.created_at,
                    updated_at=i.updated_at,
                )
            )
        return items

    def for_customer(self, db: Session, customer_id: UUID, user_id: UUID) -> List[InquiryListItem]:
        rows = (
            db.query(Inquiry)
            .filter(Inquiry.customer_id == customer_id, Inquiry.user_id == user_id)
            .order_by(Inquiry.created_at.desc(), Inquiry.id.asc())
            .all()
        )
        return self.to_items(db, rows)

    # ── list / read ──────────────────────────────────────────────────────

    def list(
        self,
        db: Session,
        user_id: UUID,
        *,
        q: Optional[str] = None,
        stage: Optional[str] = None,
        customer_id: Optional[UUID] = None,
        sort: str = "updated_desc",
        page: int = 1,
        page_size: int = 100,
    ) -> PaginatedInquiries:
        query = db.query(Inquiry).filter(Inquiry.user_id == user_id)
        if customer_id:
            query = query.filter(Inquiry.customer_id == customer_id)
        if stage:
            query = query.filter(Inquiry.stage == stage)
        if q and q.strip():
            pattern = like(q.strip())
            matching_customers = db.query(Customer.id).filter(
                Customer.user_id == user_id, Customer.name.ilike(pattern, escape="\\")
            )
            query = query.filter(
                or_(Inquiry.destination.ilike(pattern, escape="\\"), Inquiry.customer_id.in_(matching_customers))
            )

        total = query.count()
        order = {
            "updated_desc": (Inquiry.updated_at.desc(),),
            "created_desc": (Inquiry.created_at.desc(),),
            "destination_asc": (func.lower(Inquiry.destination).asc(),),
            "budget_desc": (Inquiry.budget_max.desc().nulls_last(),),
            "start_asc": (Inquiry.date_from.asc().nulls_last(),),
        }.get(sort, (Inquiry.updated_at.desc(),))
        rows = query.order_by(*order, Inquiry.id.asc()).offset((page - 1) * page_size).limit(page_size).all()
        return PaginatedInquiries(
            items=self.to_items(db, rows),
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    def get(self, db: Session, user_id: UUID, inquiry_id: UUID, today: Optional[date] = None) -> InquiryDetail:
        inquiry = self._get(db, inquiry_id, user_id)
        customer = get_customer(db, inquiry.customer_id, user_id)
        base = self.to_items(db, [inquiry])[0]
        follow_ups = follow_up_service.list(
            db, user_id, view="all", today=today, inquiry_id=inquiry.id, page_size=100
        ).items
        events = (
            db.query(CustomerEvent)
            .filter(CustomerEvent.inquiry_id == inquiry.id, CustomerEvent.user_id == user_id)
            .order_by(CustomerEvent.created_at.desc(), CustomerEvent.id.asc())
            .limit(100)
            .all()
        )
        return InquiryDetail(
            **base.model_dump(),
            customer_email=customer.email,
            customer_phone=customer.phone,
            follow_ups=follow_ups,
            events=[EventResponse.model_validate(e) for e in events],
        )

    # ── create / update / delete ─────────────────────────────────────────

    @staticmethod
    def _check_group(travelers: int, brief: TravelBrief) -> None:
        if brief.children >= travelers:
            raise_fields([("travelers", "At least one traveler must be an adult. Raise the number of travelers or lower the children.")])

    def create(self, db: Session, user_id: UUID, data: InquiryCreate, today: Optional[date] = None) -> InquiryDetail:
        customer = db.query(Customer).filter(Customer.id == data.customer_id, Customer.user_id == user_id).first()
        if not customer:
            raise_fields([("customer_id", "Customer not found")])
        if customer.is_archived:
            raise_fields([("customer_id", "This customer is archived. Restore them before adding an inquiry.")])
        self._check_group(data.travelers, data.brief)

        stamp = now()
        inquiry = Inquiry(
            user_id=user_id,
            customer_id=customer.id,
            destination=data.destination,
            date_from=data.date_from,
            date_to=data.date_to,
            travelers=data.travelers,
            budget_min=data.budget_min,
            budget_max=data.budget_max,
            currency=data.currency,
            source=data.source,
            notes=data.notes,
            stage="new",
            stage_changed_at=stamp,
            brief=data.brief.model_dump(mode="json"),
        )
        db.add(inquiry)
        db.flush()
        record_event(
            db, customer, "inquiry_created", f"Started an inquiry for {data.destination}", inquiry_id=inquiry.id,
            to_stage="new",
        )
        if data.follow_up_on:
            db.add(
                FollowUp(
                    user_id=user_id,
                    customer_id=customer.id,
                    inquiry_id=inquiry.id,
                    title=f"Follow up on {data.destination}",
                    due_date=data.follow_up_on,
                )
            )
            record_event(
                db, customer, "follow_up_created", f"Scheduled a follow-up: Follow up on {data.destination}",
                inquiry_id=inquiry.id,
            )
        db.commit()
        return self.get(db, user_id, inquiry.id, today)

    def update(
        self, db: Session, user_id: UUID, inquiry_id: UUID, data: InquiryUpdate, today: Optional[date] = None
    ) -> InquiryDetail:
        inquiry = self._get(db, inquiry_id, user_id)
        changes = data.model_dump(exclude_unset=True)
        new_brief = changes.pop("brief", None)

        # The rules that span fields are checked on the record as it would be after the change.
        merged = {name: changes.get(name, getattr(inquiry, name)) for name in _EDITABLE}
        errors = []
        if merged["date_from"] and merged["date_to"] and merged["date_to"] < merged["date_from"]:
            errors.append(("date_to", "The end date can't be before the start date"))
        low, high = _decimal(merged["budget_min"]), _decimal(merged["budget_max"])
        if low is not None and high is not None and low > high:
            errors.append(("budget_min", "The minimum budget can't be above the maximum"))
        brief = TravelBrief.model_validate(new_brief) if new_brief is not None else TravelBrief.model_validate(inquiry.brief or {})
        if brief.children >= merged["travelers"]:
            errors.append(("travelers", "At least one traveler must be an adult. Raise the number of travelers or lower the children."))
        if errors:
            raise_fields(errors)

        edited = [name for name in _EDITABLE if name in changes and not _same(name, getattr(inquiry, name), changes[name])]
        for name in edited:
            setattr(inquiry, name, changes[name])
        brief_changed = new_brief is not None and brief.model_dump(mode="json") != (inquiry.brief or {})
        if brief_changed:
            inquiry.brief = brief.model_dump(mode="json")

        customer = get_customer(db, inquiry.customer_id, user_id)
        if edited:
            record_event(
                db, customer, "inquiry_updated", f"Updated the {inquiry.destination} inquiry: {names(edited)}",
                inquiry_id=inquiry.id,
            )
        if brief_changed:
            record_event(
                db, customer, "brief_updated", f"Updated the travel brief for {inquiry.destination}", inquiry_id=inquiry.id
            )
        if edited or brief_changed:
            inquiry.updated_at = now()
        db.commit()
        return self.get(db, user_id, inquiry.id, today)

    def delete(self, db: Session, user_id: UUID, inquiry_id: UUID) -> None:
        inquiry = self._get(db, inquiry_id, user_id)
        if inquiry.converted_trip_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This inquiry became a trip, so it is kept as the record of where that trip came from.",
            )
        customer = get_customer(db, inquiry.customer_id, user_id)
        # History outlives the inquiry; the database does this too (ON DELETE SET NULL), this keeps SQLite honest.
        db.query(CustomerEvent).filter(CustomerEvent.inquiry_id == inquiry.id).update(
            {CustomerEvent.inquiry_id: None}, synchronize_session=False
        )
        record_event(db, customer, "inquiry_updated", f"Deleted the inquiry for {inquiry.destination}")
        db.delete(inquiry)
        db.commit()

    # ── pipeline ─────────────────────────────────────────────────────────

    def change_stage(
        self, db: Session, user_id: UUID, inquiry_id: UUID, data: StageChange, today: Optional[date] = None
    ) -> InquiryDetail:
        inquiry = self._get(db, inquiry_id, user_id)
        current, target = inquiry.stage, data.stage
        if inquiry.converted_trip_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="This inquiry has been converted to a trip, so its stage is final.",
            )
        if current == target:
            return self.get(db, user_id, inquiry.id, today)
        if not can_move(current, target):
            options = " or ".join(STAGE_LABELS[s] for s in allowed_next(current))
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"An inquiry can't go from {STAGE_LABELS[current]} to {STAGE_LABELS[target]}. From here it can move to {options}.",
            )

        inquiry.stage = target
        inquiry.stage_changed_at = now()
        inquiry.updated_at = inquiry.stage_changed_at
        inquiry.closed_reason = data.reason if target == "closed_lost" else None
        summary = f"Moved the {inquiry.destination} inquiry from {STAGE_LABELS[current]} to {STAGE_LABELS[target]}"
        if target == "closed_lost" and data.reason:
            summary += f": {data.reason}"
        customer = get_customer(db, inquiry.customer_id, user_id)
        record_event(
            db, customer, "stage_changed", summary, inquiry_id=inquiry.id, from_stage=current, to_stage=target
        )
        db.commit()
        return self.get(db, user_id, inquiry.id, today)

    def convert(
        self, db: Session, user_id: UUID, inquiry_id: UUID, data: InquiryConvert, today: Optional[date] = None
    ) -> Tuple[InquiryDetail, TripResponse]:
        """Create a new trip from a confirmed inquiry and link the two. Never touches an existing trip."""
        inquiry = self._get(db, inquiry_id, user_id, lock=True)
        if inquiry.converted_trip_id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="This inquiry has already been converted to a trip."
            )
        if inquiry.stage != "confirmed":
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Only a confirmed inquiry can be converted. Move it to Confirmed first.",
            )

        customer = get_customer(db, inquiry.customer_id, user_id)
        trip_in = TripCreate(
            title=data.title,
            destination=data.destination,
            start_date=data.start_date,
            end_date=data.end_date,
            budget=data.budget,
        )
        try:
            trip = trip_repository.create(db, trip_in, user_id=user_id, customer_id=customer.id, commit=False)
            inquiry.converted_trip_id = trip.id
            inquiry.converted_at = now()
            inquiry.updated_at = inquiry.converted_at
            record_event(
                db, customer, "converted_to_trip", f"Created the trip “{trip.title}” from the {inquiry.destination} inquiry",
                inquiry_id=inquiry.id,
            )
            db.commit()
        except IntegrityError:
            db.rollback()
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT, detail="This inquiry has already been converted to a trip."
            )
        db.refresh(trip)
        cache.delete_cache(get_owner_dashboard_cache_key(user_id))
        return self.get(db, user_id, inquiry.id, today), TripResponse.model_validate(trip)


inquiry_service = InquiryService()
