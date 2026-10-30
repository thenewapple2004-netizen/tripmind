"""Small helpers shared by the customer, inquiry and follow-up services."""

from datetime import datetime, timezone
from typing import Iterable, Optional, Sequence
from uuid import UUID

from fastapi import HTTPException, status
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session

from app.models.customer import Customer, CustomerEvent


def now() -> datetime:
    return datetime.now(timezone.utc)


def like(term: str) -> str:
    """A LIKE pattern that treats the user's text literally (use with `escape="\\\\"`)."""
    return "%" + term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"


def raise_fields(errors: Sequence[tuple]) -> None:
    """422 with one message per field, in the shape the forms already know how to display."""
    raise RequestValidationError(
        [{"type": "value_error", "loc": ("body", field), "msg": message, "input": None} for field, message in errors]
    )


def get_customer(db: Session, customer_id: UUID, user_id: UUID) -> Customer:
    # 404 rather than 403 for someone else's customer, so ids can't be probed.
    customer = db.query(Customer).filter(Customer.id == customer_id, Customer.user_id == user_id).first()
    if not customer:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Customer not found")
    return customer


def record_event(
    db: Session,
    customer: Customer,
    kind: str,
    summary: str,
    *,
    inquiry_id: Optional[UUID] = None,
    from_stage: Optional[str] = None,
    to_stage: Optional[str] = None,
) -> CustomerEvent:
    """Adds a line to the customer's history and marks the customer as active. The caller commits.
    `summary` must never contain an email address or phone number."""
    stamp = now()
    event = CustomerEvent(
        user_id=customer.user_id,
        customer_id=customer.id,
        inquiry_id=inquiry_id,
        kind=kind,
        summary=summary[:600],
        from_stage=from_stage,
        to_stage=to_stage,
        created_at=stamp,
    )
    db.add(event)
    customer.last_activity_at = stamp
    return event


def names(fields: Iterable[str]) -> str:
    """["a_b", "c"] -> "a b, c" for a history line."""
    return ", ".join(f.replace("_", " ") for f in fields)
