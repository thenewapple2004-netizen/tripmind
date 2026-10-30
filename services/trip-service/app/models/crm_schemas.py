"""
Request and response shapes for customers, inquiries, travel briefs and follow-ups.

Customers are owner-kept records, not accounts. Contact details only ever appear in responses to the owner
who holds the record; list responses for the pipeline and follow-ups carry the customer's name and nothing more.
"""

import re
from datetime import date, datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StrictBool, field_validator, model_validator

from app.core.currencies import CURRENCIES
from app.models.customer import CONTACT_METHODS, INQUIRY_SOURCES, INQUIRY_STAGES
from app.models.schemas import TripBase, clean_text

MAX_BUDGET = 99_999_999.99  # the Trip table's own ceiling, so a budget can always become a trip
MAX_TRAVELERS = 500
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")
_PHONE = re.compile(r"^\+?[\d\s().\-]+$")
_EARLIEST, _LATEST = date(2000, 1, 1), date(2100, 12, 31)

ContactMethod = Literal[CONTACT_METHODS]  # type: ignore[valid-type]
Stage = Literal[INQUIRY_STAGES]  # type: ignore[valid-type]
Source = Literal[INQUIRY_SOURCES]  # type: ignore[valid-type]


def _email(value: Optional[str]) -> Optional[str]:
    value = clean_text(value)
    if value is None:
        return None
    if len(value) > 254 or not _EMAIL.match(value):
        raise ValueError("Enter a valid email address")
    return value.lower()


def _phone(value: Optional[str]) -> Optional[str]:
    value = clean_text(value)
    if value is None:
        return None
    digits = sum(ch.isdigit() for ch in value)
    if len(value) > 30 or not _PHONE.match(value) or not 6 <= digits <= 15:
        raise ValueError("Enter a valid phone number, for example +92 300 1234567")
    return value


def _currency(value: str) -> str:
    value = value.strip().upper()
    if value not in CURRENCIES:
        raise ValueError("Unsupported currency")
    return value


# ==========================================
# Customers
# ==========================================


class CustomerFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(..., min_length=1, max_length=120)
    email: Optional[str] = Field(None, max_length=254)
    phone: Optional[str] = Field(None, max_length=30)
    city: Optional[str] = Field(None, max_length=80)
    country: Optional[str] = Field(None, max_length=80)
    preferred_contact: ContactMethod = "any"
    preferences: Optional[str] = Field(None, max_length=2000)
    notes: Optional[str] = Field(None, max_length=4000)

    @field_validator("name")
    @classmethod
    def _name(cls, value):
        value = clean_text(value)
        if not value:
            raise ValueError("Enter the customer's name")
        return value

    @field_validator("email")
    @classmethod
    def _check_email(cls, value):
        return _email(value)

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, value):
        return _phone(value)

    @field_validator("city", "country")
    @classmethod
    def _single_line(cls, value):
        return clean_text(value)

    @field_validator("preferences", "notes")
    @classmethod
    def _multi_line(cls, value):
        return clean_text(value, multiline=True)


class CustomerCreate(CustomerFields):
    @model_validator(mode="after")
    def _reachable(self):
        if not self.email and not self.phone:
            raise ValueError("Add an email address or a phone number so you can reach this customer")
        return self


class CustomerUpdate(BaseModel):
    """Only what is sent changes; sending null clears an optional field."""

    model_config = ConfigDict(extra="forbid")

    name: Optional[str] = Field(None, min_length=1, max_length=120)
    email: Optional[str] = Field(None, max_length=254)
    phone: Optional[str] = Field(None, max_length=30)
    city: Optional[str] = Field(None, max_length=80)
    country: Optional[str] = Field(None, max_length=80)
    preferred_contact: Optional[ContactMethod] = None
    preferences: Optional[str] = Field(None, max_length=2000)
    notes: Optional[str] = Field(None, max_length=4000)
    is_archived: Optional[bool] = None

    @field_validator("name")
    @classmethod
    def _name(cls, value):
        if value is None:
            return value
        value = clean_text(value)
        if not value:
            raise ValueError("Enter the customer's name")
        return value

    @field_validator("email")
    @classmethod
    def _check_email(cls, value):
        return _email(value)

    @field_validator("phone")
    @classmethod
    def _check_phone(cls, value):
        return _phone(value)

    @field_validator("city", "country")
    @classmethod
    def _single_line(cls, value):
        return clean_text(value)

    @field_validator("preferences", "notes")
    @classmethod
    def _multi_line(cls, value):
        return clean_text(value, multiline=True)

    @model_validator(mode="after")
    def _no_nulls(self):
        for name in ("name", "preferred_contact", "is_archived"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class CustomerRef(BaseModel):
    """The customer as the pipeline and follow-up lists show them: a name, no contact details."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str


class CustomerSummary(BaseModel):
    """One row of the directory."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    preferred_contact: str
    is_archived: bool
    created_at: datetime
    last_activity_at: datetime
    open_inquiries: int = 0
    total_inquiries: int = 0
    trip_count: int = 0
    next_follow_up_on: Optional[date] = None


class PaginatedCustomers(BaseModel):
    items: List[CustomerSummary]
    total: int
    page: int
    page_size: int
    total_pages: int


class CustomerTripItem(BaseModel):
    id: UUID
    title: str
    destination: str
    start_date: date
    end_date: date
    budget: float
    booking_count: int = 0
    inquiry_id: Optional[UUID] = None


class CustomerBookingItem(BaseModel):
    id: UUID
    trip_id: UUID
    trip_title: str
    type: str
    title: str
    status: str
    start_date: date
    total_cost: float
    currency: str


class EventResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    kind: str
    summary: str
    from_stage: Optional[str] = None
    to_stage: Optional[str] = None
    inquiry_id: Optional[UUID] = None
    created_at: datetime


class PaginatedEvents(BaseModel):
    items: List[EventResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class NoteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    summary: str = Field(..., min_length=1, max_length=600)
    inquiry_id: Optional[UUID] = None

    @field_validator("summary")
    @classmethod
    def _summary(cls, value):
        value = clean_text(value, multiline=True)
        if not value:
            raise ValueError("Write a note")
        return value


# ==========================================
# Travel brief
# ==========================================

ACCOMMODATION_TYPES = ("hotel", "guesthouse", "resort", "lodge", "apartment", "hostel", "camping", "homestay")
COMFORT_LEVELS = ("budget", "midrange", "upscale", "luxury")
TRAVEL_STYLES = (
    "adventure", "relaxation", "culture", "nature", "family", "romantic", "luxury", "budget", "photography", "food",
)
PACES = ("relaxed", "balanced", "fast")


class TravelBrief(BaseModel):
    """What the customer wants from the trip, beyond the headline facts on the inquiry. Every part is
    optional, so a brief can start with one line and grow as the conversation does."""

    model_config = ConfigDict(extra="forbid")

    flexible_dates: bool = False
    flexibility_days: Optional[int] = Field(None, ge=1, le=60, description="Days either side of the preferred dates")
    trip_length_nights: Optional[int] = Field(None, ge=1, le=365)

    children: int = Field(0, ge=0, le=MAX_TRAVELERS, description="How many of the travelers are children")

    accommodation_types: List[Literal[ACCOMMODATION_TYPES]] = Field(default_factory=list, max_length=len(ACCOMMODATION_TYPES))  # type: ignore[valid-type]
    comfort_level: Optional[Literal[COMFORT_LEVELS]] = None  # type: ignore[valid-type]
    room_preferences: Optional[str] = Field(None, max_length=300)

    travel_styles: List[Literal[TRAVEL_STYLES]] = Field(default_factory=list, max_length=len(TRAVEL_STYLES))  # type: ignore[valid-type]
    pace: Optional[Literal[PACES]] = None  # type: ignore[valid-type]
    transport_preferences: Optional[str] = Field(None, max_length=300)

    special_requests: Optional[str] = Field(None, max_length=1500)
    additional_notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("accommodation_types", "travel_styles")
    @classmethod
    def _unique(cls, value):
        return list(dict.fromkeys(value))

    @field_validator("room_preferences", "transport_preferences")
    @classmethod
    def _single_line(cls, value):
        return clean_text(value)

    @field_validator("special_requests", "additional_notes")
    @classmethod
    def _multi_line(cls, value):
        return clean_text(value, multiline=True)

    @model_validator(mode="after")
    def _flexibility(self):
        if not self.flexible_dates and self.flexibility_days is not None:
            raise ValueError("Turn on flexible dates to set how many days either side")
        return self


# ==========================================
# Inquiries
# ==========================================


def _check_dates(date_from: Optional[date], date_to: Optional[date]) -> None:
    for value in (date_from, date_to):
        if value is not None and not _EARLIEST <= value <= _LATEST:
            raise ValueError("Enter a valid date")
    if date_from and date_to and date_to < date_from:
        raise ValueError("The end date can't be before the start date")


def _check_budget(low: Optional[float], high: Optional[float]) -> None:
    if low is not None and high is not None and low > high:
        raise ValueError("The minimum budget can't be above the maximum")


class InquiryFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    destination: str = Field(..., min_length=1, max_length=100)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    travelers: int = Field(1, ge=1, le=MAX_TRAVELERS)
    budget_min: Optional[float] = Field(None, ge=0, le=MAX_BUDGET)
    budget_max: Optional[float] = Field(None, ge=0, le=MAX_BUDGET)
    currency: str = "USD"
    source: Source = "other"
    notes: Optional[str] = Field(None, max_length=2000)

    @field_validator("destination")
    @classmethod
    def _destination(cls, value):
        value = clean_text(value)
        if not value:
            raise ValueError("Enter a destination")
        return value

    @field_validator("notes")
    @classmethod
    def _notes(cls, value):
        return clean_text(value, multiline=True)

    @field_validator("currency")
    @classmethod
    def _check_currency(cls, value):
        return _currency(value)

    @model_validator(mode="after")
    def _ranges(self):
        _check_dates(self.date_from, self.date_to)
        _check_budget(self.budget_min, self.budget_max)
        return self


class InquiryCreate(InquiryFields):
    customer_id: UUID
    brief: TravelBrief = Field(default_factory=TravelBrief)
    # Schedules the first follow-up. The inquiry's "next follow-up" is read from its follow-ups, never typed twice.
    follow_up_on: Optional[date] = None

    @field_validator("follow_up_on")
    @classmethod
    def _follow_up_on(cls, value):
        if value is not None and not _EARLIEST <= value <= _LATEST:
            raise ValueError("Enter a valid date")
        return value


class InquiryUpdate(BaseModel):
    """Only what is sent changes. A `brief` that is sent replaces the whole brief (the form always sends all of it)."""

    model_config = ConfigDict(extra="forbid")

    destination: Optional[str] = Field(None, min_length=1, max_length=100)
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    travelers: Optional[int] = Field(None, ge=1, le=MAX_TRAVELERS)
    budget_min: Optional[float] = Field(None, ge=0, le=MAX_BUDGET)
    budget_max: Optional[float] = Field(None, ge=0, le=MAX_BUDGET)
    currency: Optional[str] = None
    source: Optional[Source] = None
    notes: Optional[str] = Field(None, max_length=2000)
    brief: Optional[TravelBrief] = None

    @field_validator("destination")
    @classmethod
    def _destination(cls, value):
        if value is None:
            return value
        value = clean_text(value)
        if not value:
            raise ValueError("Enter a destination")
        return value

    @field_validator("notes")
    @classmethod
    def _notes(cls, value):
        return clean_text(value, multiline=True)

    @field_validator("currency")
    @classmethod
    def _check_currency(cls, value):
        return None if value is None else _currency(value)

    @model_validator(mode="after")
    def _ranges(self):
        for name in ("destination", "travelers", "currency", "source", "brief"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        _check_dates(self.date_from, self.date_to)
        _check_budget(self.budget_min, self.budget_max)
        return self


class StageChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stage: Stage
    reason: Optional[str] = Field(None, max_length=300)

    @field_validator("reason")
    @classmethod
    def _reason(cls, value):
        return clean_text(value)


class InquiryListItem(BaseModel):
    """An inquiry as the board, the list and a customer's history show it."""

    id: UUID
    customer: CustomerRef
    destination: str
    date_from: Optional[date] = None
    date_to: Optional[date] = None
    travelers: int
    budget_min: Optional[float] = None
    budget_max: Optional[float] = None
    currency: str
    source: str
    notes: Optional[str] = None
    stage: str
    stage_changed_at: datetime
    closed_reason: Optional[str] = None
    brief: TravelBrief
    next_follow_up_on: Optional[date] = None
    open_follow_ups: int = 0
    allowed_stages: List[str] = Field(default_factory=list)
    converted_trip_id: Optional[UUID] = None
    converted_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class PaginatedInquiries(BaseModel):
    items: List[InquiryListItem]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==========================================
# Follow-ups
# ==========================================

FollowUpView = Literal["today", "upcoming", "overdue", "open", "completed", "all"]


def _check_due(value: Optional[date]) -> Optional[date]:
    if value is not None and not _EARLIEST <= value <= _LATEST:
        raise ValueError("Enter a valid date")
    return value


class FollowUpCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str = Field(..., min_length=1, max_length=150)
    notes: Optional[str] = Field(None, max_length=1000)
    due_date: date
    customer_id: Optional[UUID] = None
    inquiry_id: Optional[UUID] = None

    @field_validator("title")
    @classmethod
    def _title(cls, value):
        value = clean_text(value)
        if not value:
            raise ValueError("Say what needs doing")
        return value

    @field_validator("notes")
    @classmethod
    def _notes(cls, value):
        return clean_text(value, multiline=True)

    @field_validator("due_date")
    @classmethod
    def _due(cls, value):
        return _check_due(value)

    @model_validator(mode="after")
    def _has_subject(self):
        if not self.customer_id and not self.inquiry_id:
            raise ValueError("Link the follow-up to a customer or an inquiry")
        return self


class FollowUpUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: Optional[str] = Field(None, min_length=1, max_length=150)
    notes: Optional[str] = Field(None, max_length=1000)
    due_date: Optional[date] = None
    completed: Optional[bool] = None

    @field_validator("title")
    @classmethod
    def _title(cls, value):
        if value is None:
            return value
        value = clean_text(value)
        if not value:
            raise ValueError("Say what needs doing")
        return value

    @field_validator("notes")
    @classmethod
    def _notes(cls, value):
        return clean_text(value, multiline=True)

    @field_validator("due_date")
    @classmethod
    def _due(cls, value):
        return _check_due(value)

    @model_validator(mode="after")
    def _no_nulls(self):
        for name in ("title", "due_date", "completed"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class FollowUpResponse(BaseModel):
    id: UUID
    customer: CustomerRef
    inquiry_id: Optional[UUID] = None
    inquiry_destination: Optional[str] = None
    title: str
    notes: Optional[str] = None
    due_date: date
    completed_at: Optional[datetime] = None
    is_completed: bool
    # overdue | today | upcoming | completed, relative to the date the caller said it is.
    status: str
    created_at: datetime


class PaginatedFollowUps(BaseModel):
    items: List[FollowUpResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


class FollowUpSummary(BaseModel):
    overdue: int
    today: int
    upcoming: int


# ==========================================
# Customer 360 and conversion
# ==========================================


class CustomerDetail(BaseModel):
    id: UUID
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    city: Optional[str] = None
    country: Optional[str] = None
    preferred_contact: str
    preferences: Optional[str] = None
    notes: Optional[str] = None
    is_archived: bool
    created_at: datetime
    updated_at: datetime
    last_activity_at: datetime
    inquiries: List[InquiryListItem] = Field(default_factory=list)
    trips: List[CustomerTripItem] = Field(default_factory=list)
    bookings: List[CustomerBookingItem] = Field(default_factory=list)
    follow_ups: List[FollowUpResponse] = Field(default_factory=list)


class InquiryDetail(InquiryListItem):
    """The full inquiry: the customer's contact details, the follow-ups and the history of stage changes."""

    customer_email: Optional[str] = None
    customer_phone: Optional[str] = None
    follow_ups: List[FollowUpResponse] = Field(default_factory=list)
    events: List[EventResponse] = Field(default_factory=list)


class InquiryConvert(TripBase):
    """The trip to create. Title, destination, dates and budget are prefilled in the form and may be changed;
    `confirm` must be sent as true, so a conversion is always a deliberate act."""

    # Required, and a real boolean: leaving it out (or sending "yes") must never count as consent.
    confirm: StrictBool

    @field_validator("confirm")
    @classmethod
    def _confirmed(cls, value):
        if value is not True:
            raise ValueError("Confirm that you want to create a trip from this inquiry")
        return value
