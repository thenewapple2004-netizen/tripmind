"""
The rules that make a booking valid, kept free of the database so they are easy to test.

Two ideas live here:

* **Type-specific details.** A flight has a flight number and airports, a hotel an address and
  guests, a transfer a pickup and drop-off, an activity a meeting point. Each type has its own small
  model, and a booking's `details` must match the model for its `type`. Anything extra is rejected.
* **Errors that name the field.** Problems are returned as `(field, message)` pairs, so the form can
  put the message next to the input at fault (`arrival_airport`), not in a vague banner.

Reservations also become *events on the itinerary*: a hotel is a check-in on one day and a check-out
on another. `reservation_events` computes those, but never writes to activities.
"""

import re
from datetime import date, time
from typing import Any, Dict, List, Literal, Optional, Tuple

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator

from app.models.schemas import ItineraryReservation, clean_text

FieldError = Tuple[str, str]


def _text(value: Optional[str]) -> Optional[str]:
    return clean_text(value)


class _Details(BaseModel):
    model_config = ConfigDict(extra="forbid")


class FlightDetails(_Details):
    flight_number: str = Field(..., min_length=1, max_length=10)
    airline: Optional[str] = Field(None, max_length=80)
    departure_airport: str
    arrival_airport: str
    departure_terminal: Optional[str] = Field(None, max_length=10)
    arrival_terminal: Optional[str] = Field(None, max_length=10)
    seat: Optional[str] = Field(None, max_length=10)
    cabin_class: Optional[Literal["economy", "premium_economy", "business", "first"]] = None

    @field_validator("flight_number")
    @classmethod
    def _flight_number(cls, value: str) -> str:
        # "pk 305", "PK305" and "pk-305" all become "PK305": a 2-3 character airline code and 1-4 digits.
        compact = re.sub(r"[\s-]", "", value).upper()
        if not re.fullmatch(r"[A-Z0-9]{2,3}\d{1,4}[A-Z]?", compact):
            raise ValueError("Enter a flight number like PK305 or EK 614")
        return compact

    @field_validator("departure_airport", "arrival_airport")
    @classmethod
    def _airport(cls, value: str) -> str:
        code = value.strip().upper()
        if not re.fullmatch(r"[A-Z]{3}", code):
            raise ValueError("Use the 3-letter airport code, like ISB or DXB")
        return code

    @field_validator("airline", "departure_terminal", "arrival_terminal", "seat")
    @classmethod
    def _clean(cls, value):
        return _text(value)


class HotelDetails(_Details):
    address: Optional[str] = Field(None, max_length=200)
    room_type: Optional[str] = Field(None, max_length=80)
    guests: Optional[int] = Field(None, ge=1, le=20)

    @field_validator("address", "room_type")
    @classmethod
    def _clean(cls, value):
        return _text(value)


class TransportationDetails(_Details):
    mode: Literal["car", "taxi", "train", "bus", "ferry", "shuttle", "other"] = "other"
    pickup_location: str = Field(..., min_length=1, max_length=200)
    dropoff_location: str = Field(..., min_length=1, max_length=200)
    vehicle: Optional[str] = Field(None, max_length=80)

    @field_validator("pickup_location", "dropoff_location")
    @classmethod
    def _required_text(cls, value: str) -> str:
        cleaned = _text(value)
        if not cleaned:
            raise ValueError("This is required")
        return cleaned

    @field_validator("vehicle")
    @classmethod
    def _clean(cls, value):
        return _text(value)


class ActivityBookingDetails(_Details):
    participants: Optional[int] = Field(None, ge=1, le=100)
    meeting_point: Optional[str] = Field(None, max_length=200)

    @field_validator("meeting_point")
    @classmethod
    def _clean(cls, value):
        return _text(value)


DETAILS_MODELS: Dict[str, type[BaseModel]] = {
    "flight": FlightDetails,
    "hotel": HotelDetails,
    "transportation": TransportationDetails,
    "activity": ActivityBookingDetails,
}


def _minutes(t: Optional[time]) -> int:
    return t.hour * 60 + t.minute if t else 0


def validate_booking(fields: Dict[str, Any]) -> Tuple[Dict[str, Any], List[FieldError]]:
    """Checks a complete booking (already merged, for an update). Returns the cleaned `details` and
    every problem found, each tied to the field that should be fixed."""
    errors: List[FieldError] = []
    booking_type = fields["type"]

    # 1. The details must match the type, and are normalised (airport codes upper-cased, etc.).
    details: Dict[str, Any] = {}
    try:
        details = DETAILS_MODELS[booking_type].model_validate(fields.get("details") or {}).model_dump(
            exclude_none=True, mode="json"
        )
    except ValidationError as exc:
        for issue in exc.errors():
            field = str(issue["loc"][0]) if issue["loc"] else "details"
            message = issue["msg"].removeprefix("Value error, ")
            if issue["type"] == "missing":
                message = "This is required"
            elif issue["type"] == "extra_forbidden":
                message = f"“{field}” doesn't apply to a {booking_type} booking"
            errors.append((field, message))

    if booking_type == "flight" and not errors:
        if details["departure_airport"] == details["arrival_airport"]:
            errors.append(("arrival_airport", "The arrival airport must differ from the departure airport"))

    # 2. Dates and times.
    start_date: date = fields["start_date"]
    end_date: Optional[date] = fields.get("end_date")
    start_time: Optional[time] = fields.get("start_time")
    end_time: Optional[time] = fields.get("end_time")

    if end_date is not None and end_date < start_date:
        errors.append(("end_date", "The end date can't be before the start date"))
    elif booking_type == "hotel":
        if end_date is None:
            errors.append(("end_date", "Add the check-out date"))
        elif end_date <= start_date:
            errors.append(("end_date", "Check-out must be after check-in"))

    # An end time on its own means "later the same day".
    effective_end = end_date or start_date
    if end_time is not None and effective_end == start_date and start_time is not None:
        if _minutes(end_time) <= _minutes(start_time):
            errors.append(("end_time", "The end time must be after the start time"))

    # 3. Free cancellation has to end on or before the booking starts, or it isn't a deadline.
    free_until = fields.get("free_cancellation_until")
    if free_until is not None and free_until > start_date:
        errors.append(("free_cancellation_until", "Free cancellation must end on or before the start date"))

    return details, errors


# ── Itinerary events ──────────────────────────────────────────────────────

# Only these statuses appear on the itinerary: a pending booking isn't certain yet and a cancelled
# one is gone.
ITINERARY_STATUSES = ("confirmed", "completed")


def reservation_events(booking) -> List[ItineraryReservation]:
    """The moments a booking contributes to the itinerary (departure and arrival, check-in and
    check-out, pickup and drop-off, or the single start of an activity)."""
    if booking.status not in ITINERARY_STATUSES:
        return []

    def event(label: str, day: date, at: Optional[time]) -> ItineraryReservation:
        return ItineraryReservation(
            booking_id=booking.id,
            type=booking.type,
            status=booking.status,
            title=booking.title,
            provider=booking.provider,
            confirmation_number=booking.confirmation_number,
            location=booking.location,
            label=label,
            date=day,
            time=at,
        )

    has_end = booking.end_date is not None or booking.end_time is not None
    end_day = booking.end_date or booking.start_date
    labels = {
        "flight": ("Departs", "Arrives"),
        "hotel": ("Check-in", "Check-out"),
        "transportation": ("Pickup", "Drop-off"),
        "activity": ("Reservation", None),
    }[booking.type]

    events = [event(labels[0], booking.start_date, booking.start_time)]
    if labels[1] and has_end:
        events.append(event(labels[1], end_day, booking.end_time))
    return events
