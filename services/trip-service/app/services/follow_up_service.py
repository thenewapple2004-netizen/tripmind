"""
Follow-up tasks: reminders to contact a customer or move an inquiry on. Every row is a real record the owner
created; nothing here is generated. "Today", "Upcoming" and "Overdue" are decided against the date the caller
sends (the owner's own calendar day), falling back to the server's date.
"""

import math
from datetime import date
from typing import Dict, List, Optional, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.crm_schemas import (
    CustomerRef,
    FollowUpCreate,
    FollowUpResponse,
    FollowUpSummary,
    FollowUpUpdate,
    PaginatedFollowUps,
)
from app.models.customer import Customer, FollowUp, Inquiry
from app.services.crm_common import get_customer, now, raise_fields, record_event

VIEWS = ("today", "upcoming", "overdue", "open", "completed", "all")


def follow_up_status(due: date, completed: bool, today: date) -> str:
    if completed:
        return "completed"
    if due < today:
        return "overdue"
    return "today" if due == today else "upcoming"


class FollowUpService:
    def _get(self, db: Session, follow_up_id: UUID, user_id: UUID) -> FollowUp:
        item = db.query(FollowUp).filter(FollowUp.id == follow_up_id, FollowUp.user_id == user_id).first()
        if not item:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Follow-up not found")
        return item

    def to_responses(self, db: Session, items: Sequence[FollowUp], today: date) -> List[FollowUpResponse]:
        """Adds the customer's name and the inquiry's destination, looked up once for the whole list."""
        customer_ids = {i.customer_id for i in items}
        inquiry_ids = {i.inquiry_id for i in items if i.inquiry_id}
        customer_names: Dict[UUID, str] = (
            dict(db.query(Customer.id, Customer.name).filter(Customer.id.in_(customer_ids)).all()) if customer_ids else {}
        )
        destinations: Dict[UUID, str] = (
            dict(db.query(Inquiry.id, Inquiry.destination).filter(Inquiry.id.in_(inquiry_ids)).all()) if inquiry_ids else {}
        )
        return [
            FollowUpResponse(
                id=i.id,
                customer=CustomerRef(id=i.customer_id, name=customer_names.get(i.customer_id, "")),
                inquiry_id=i.inquiry_id,
                inquiry_destination=destinations.get(i.inquiry_id) if i.inquiry_id else None,
                title=i.title,
                notes=i.notes,
                due_date=i.due_date,
                completed_at=i.completed_at,
                is_completed=i.completed_at is not None,
                status=follow_up_status(i.due_date, i.completed_at is not None, today),
                created_at=i.created_at,
            )
            for i in items
        ]

    def list(
        self,
        db: Session,
        user_id: UUID,
        *,
        view: str = "open",
        today: Optional[date] = None,
        customer_id: Optional[UUID] = None,
        inquiry_id: Optional[UUID] = None,
        page: int = 1,
        page_size: int = 50,
    ) -> PaginatedFollowUps:
        today = today or date.today()
        query = db.query(FollowUp).filter(FollowUp.user_id == user_id)
        if customer_id:
            query = query.filter(FollowUp.customer_id == customer_id)
        if inquiry_id:
            query = query.filter(FollowUp.inquiry_id == inquiry_id)

        if view == "completed":
            query = query.filter(FollowUp.completed_at.is_not(None))
            ordering = (FollowUp.completed_at.desc(), FollowUp.id.asc())
        else:
            if view != "all":
                query = query.filter(FollowUp.completed_at.is_(None))
            if view == "overdue":
                query = query.filter(FollowUp.due_date < today)
            elif view == "today":
                query = query.filter(FollowUp.due_date == today)
            elif view == "upcoming":
                query = query.filter(FollowUp.due_date > today)
            ordering = (FollowUp.due_date.asc(), FollowUp.created_at.asc(), FollowUp.id.asc())
            if view == "all":
                # Open items first (soonest due), finished ones after.
                ordering = (FollowUp.completed_at.is_not(None), *ordering)

        total = query.count()
        items = query.order_by(*ordering).offset((page - 1) * page_size).limit(page_size).all()
        return PaginatedFollowUps(
            items=self.to_responses(db, items, today),
            total=total,
            page=page,
            page_size=page_size,
            total_pages=math.ceil(total / page_size) if total else 1,
        )

    def summary(self, db: Session, user_id: UUID, today: Optional[date] = None) -> FollowUpSummary:
        today = today or date.today()
        open_items = db.query(FollowUp).filter(FollowUp.user_id == user_id, FollowUp.completed_at.is_(None))
        return FollowUpSummary(
            overdue=open_items.filter(FollowUp.due_date < today).count(),
            today=open_items.filter(FollowUp.due_date == today).count(),
            upcoming=open_items.filter(FollowUp.due_date > today).count(),
        )

    def create(self, db: Session, user_id: UUID, data: FollowUpCreate, today: Optional[date] = None) -> FollowUpResponse:
        customer_id = data.customer_id
        inquiry: Optional[Inquiry] = None
        if data.inquiry_id:
            inquiry = db.query(Inquiry).filter(Inquiry.id == data.inquiry_id, Inquiry.user_id == user_id).first()
            if not inquiry:
                raise_fields([("inquiry_id", "Inquiry not found")])
            if customer_id and customer_id != inquiry.customer_id:
                raise_fields([("customer_id", "That inquiry belongs to a different customer")])
            customer_id = inquiry.customer_id
        customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == user_id).first()
        if not customer:
            raise_fields([("customer_id", "Customer not found")])

        item = FollowUp(
            user_id=user_id,
            customer_id=customer.id,
            inquiry_id=inquiry.id if inquiry else None,
            title=data.title,
            notes=data.notes,
            due_date=data.due_date,
        )
        db.add(item)
        record_event(
            db, customer, "follow_up_created", f"Scheduled a follow-up: {data.title}",
            inquiry_id=inquiry.id if inquiry else None,
        )
        db.commit()
        db.refresh(item)
        return self.to_responses(db, [item], today or date.today())[0]

    def update(
        self, db: Session, user_id: UUID, follow_up_id: UUID, data: FollowUpUpdate, today: Optional[date] = None
    ) -> FollowUpResponse:
        item = self._get(db, follow_up_id, user_id)
        changes = data.model_dump(exclude_unset=True)
        completed = changes.pop("completed", None)

        edited = [k for k, v in changes.items() if getattr(item, k) != v]
        for key in edited:
            setattr(item, key, changes[key])

        customer = get_customer(db, item.customer_id, user_id)
        if completed is True and item.completed_at is None:
            item.completed_at = now()
            record_event(db, customer, "follow_up_completed", f"Completed a follow-up: {item.title}", inquiry_id=item.inquiry_id)
        elif completed is False and item.completed_at is not None:
            item.completed_at = None
            record_event(db, customer, "follow_up_reopened", f"Reopened a follow-up: {item.title}", inquiry_id=item.inquiry_id)
        elif edited:
            customer.last_activity_at = now()
        db.commit()
        db.refresh(item)
        return self.to_responses(db, [item], today or date.today())[0]

    def delete(self, db: Session, user_id: UUID, follow_up_id: UUID) -> None:
        item = self._get(db, follow_up_id, user_id)
        db.delete(item)
        db.commit()


follow_up_service = FollowUpService()
