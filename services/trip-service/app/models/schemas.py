from decimal import Decimal
from datetime import date, datetime, time
from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, condecimal, field_validator, model_validator


# ==========================================
# Expense Schemas
# ==========================================

VALID_EXPENSE_CATEGORIES = [
    "Food",
    "Transportation",
    "Accommodation",
    "Activities",
    "Shopping",
    "Other",
]


class ExpenseBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150, description="Title of the expense")
    amount: Decimal = Field(..., gt=0, decimal_places=2, max_digits=10, description="Amount spent (must be > 0)")
    category: str = Field("Other", max_length=50, description="Category of the expense")
    expense_date: date = Field(..., description="Date of the expense")
    description: Optional[str] = Field(None, max_length=1000, description="Notes/details about the expense")

    @model_validator(mode="after")
    def validate_category(self):
        if self.category not in VALID_EXPENSE_CATEGORIES:
            # Normalize title case if user sends e.g. "food" -> "Food"
            title_case = self.category.capitalize()
            if title_case in VALID_EXPENSE_CATEGORIES:
                self.category = title_case
            else:
                self.category = "Other"
        return self


class ExpenseCreate(ExpenseBase):
    pass


class ExpenseUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    amount: Optional[Decimal] = Field(None, gt=0, decimal_places=2, max_digits=10)
    category: Optional[str] = Field(None, max_length=50)
    expense_date: Optional[date] = None
    description: Optional[str] = Field(None, max_length=1000)

    @model_validator(mode="after")
    def validate_category(self):
        if self.category is not None and self.category not in VALID_EXPENSE_CATEGORIES:
            title_case = self.category.capitalize()
            self.category = title_case if title_case in VALID_EXPENSE_CATEGORIES else "Other"
        return self


class ExpenseResponse(ExpenseBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID


class CategorySummary(BaseModel):
    category: str
    total: Decimal
    count: int
    percentage: float


class BudgetSummary(BaseModel):
    budget: Decimal
    total_spent: Decimal
    remaining_budget: Decimal
    percent_spent: float
    is_over_budget: bool
    expense_count: int
    by_category: List[CategorySummary]


# ==========================================
# Activity Schemas
# ==========================================

MAX_DURATION_MINUTES = 24 * 60


def _drop_seconds(value: Optional[time]) -> Optional[time]:
    """Planner times are whole minutes; "09:30:45" is stored as 09:30."""
    return value.replace(second=0, microsecond=0, tzinfo=None) if value else value


def check_fits_in_day(start: Optional[time], duration: Optional[int]) -> None:
    """An activity may not run past midnight: the planner shows one day at a time."""
    if start is not None and duration is not None:
        if start.hour * 60 + start.minute + duration > MAX_DURATION_MINUTES:
            raise ValueError("The activity would run past midnight. Shorten it or start it earlier.")


class ActivityBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150, description="Title of the activity")
    description: Optional[str] = Field(None, max_length=1000, description="Notes/details about activity")
    location: Optional[str] = Field(None, max_length=150, description="Location of activity")
    activity_date: date = Field(..., description="Date of the activity")
    cost: float = Field(0.0, ge=0, description="Cost of the activity (must be >= 0)")
    start_time: Optional[time] = Field(None, description="Local start time (HH:MM), optional")
    duration_minutes: Optional[int] = Field(None, ge=5, le=MAX_DURATION_MINUTES, description="Length in minutes (5 to 1440)")

    @field_validator("start_time")
    @classmethod
    def _whole_minutes(cls, value):
        return _drop_seconds(value)

    @model_validator(mode="after")
    def _fits_in_day(self):
        check_fits_in_day(self.start_time, self.duration_minutes)
        return self


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=150)
    activity_date: Optional[date] = None
    cost: Optional[float] = Field(None, ge=0)
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = Field(None, ge=5, le=MAX_DURATION_MINUTES)

    @field_validator("start_time")
    @classmethod
    def _whole_minutes(cls, value):
        return _drop_seconds(value)

    @model_validator(mode="after")
    def _fits_in_day(self):
        check_fits_in_day(self.start_time, self.duration_minutes)
        return self


class ActivityResponse(ActivityBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    position: int = 0


# ==========================================
# Itinerary planner schemas
# ==========================================

class ActivityMove(BaseModel):
    """Where one activity should end up: its day and its slot within that day."""
    id: UUID
    activity_date: date
    position: int = Field(..., ge=0, le=10_000)


class ArrangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    moves: List[ActivityMove] = Field(..., min_length=1, max_length=500)

    @model_validator(mode="after")
    def _unique_ids(self):
        ids = [m.id for m in self.moves]
        if len(ids) != len(set(ids)):
            raise ValueError("Each activity can appear only once")
        return self


class ItineraryConflict(BaseModel):
    activity_date: date
    activity_ids: List[UUID]
    overlap_minutes: int


class ItineraryDay(BaseModel):
    date: date
    day_number: int
    activities: List[ActivityResponse]
    total_cost: float
    scheduled_minutes: int


class ItineraryResponse(BaseModel):
    trip_id: UUID
    start_date: date
    end_date: date
    total_activities: int
    unscheduled_count: int
    days: List[ItineraryDay]
    conflicts: List[ItineraryConflict]


# ==========================================
# Checklist schemas
# ==========================================

CHECKLIST_CATEGORIES = ("documents", "packing", "bookings", "health", "other")


class ChecklistItemCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(..., min_length=1, max_length=200)
    category: Literal[CHECKLIST_CATEGORIES] = "other"  # type: ignore[valid-type]

    @field_validator("text")
    @classmethod
    def _trim(cls, value):
        value = " ".join(value.split())
        if not value:
            raise ValueError("Text can't be blank")
        return value


class ChecklistItemUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: Optional[str] = Field(None, min_length=1, max_length=200)
    category: Optional[Literal[CHECKLIST_CATEGORIES]] = None  # type: ignore[valid-type]
    is_done: Optional[bool] = None

    @field_validator("text")
    @classmethod
    def _trim(cls, value):
        if value is None:
            return value
        value = " ".join(value.split())
        if not value:
            raise ValueError("Text can't be blank")
        return value

    @model_validator(mode="after")
    def _no_nulls(self):
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class ChecklistItemResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    text: str
    category: str
    is_done: bool
    position: int


# ==========================================
# Travel document schemas
# ==========================================

DOCUMENT_KINDS = ("passport", "visa", "ticket", "booking", "insurance", "other")


class DocumentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID
    filename: str
    content_type: str
    size_bytes: int
    kind: str
    uploaded_at: datetime


class OwnerDocumentItem(DocumentResponse):
    trip_title: str


# ==========================================
# Trip Schemas
# ==========================================

class TripBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=100, description="Title of the trip")
    destination: str = Field(..., min_length=1, max_length=100, description="Destination city/country")
    start_date: date = Field(..., description="Trip start date")
    end_date: date = Field(..., description="Trip end date")
    budget: float = Field(..., gt=0, description="Budget in USD or chosen currency")

    @model_validator(mode="after")
    def validate_dates(self):
        if self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return self


class TripCreate(TripBase):
    pass


class TripUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=100)
    destination: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    budget: Optional[float] = Field(None, gt=0)

    @model_validator(mode="after")
    def validate_dates(self):
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date cannot be earlier than start_date")
        return self


class TripResponse(TripBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: Optional[UUID] = None
    activities: List[ActivityResponse] = []
    expenses: List[ExpenseResponse] = []


class PaginatedTripResponse(BaseModel):
    items: List[TripResponse]
    total: int
    page: int
    page_size: int
    total_pages: int


# ==========================================
# Report Schemas
# ==========================================

class ReportJobResponse(BaseModel):
    task_id: str
    trip_id: UUID
    status: str
    message: str


class ReportStatusResponse(BaseModel):
    task_id: str
    trip_id: UUID
    status: str
    message: Optional[str] = None
    result: Optional[dict] = None
    error: Optional[str] = None


# ==========================================
# Owner Profile Schemas (microservice data)
# ==========================================

class OwnerProfileResponse(BaseModel):
    """Trip owner profile fetched from the Auth Service via service-to-service call."""
    id: str
    email: str
    created_at: str
    source: str = "auth-service"  # documents which service supplied this data


# ==========================================
# Owner Dashboard & Analytics Schemas (Task 17)
# ==========================================

class OwnerDashboardOverview(BaseModel):
    total_trips: int
    upcoming_trips_count: int
    ongoing_trips_count: int
    completed_trips_count: int
    total_budget: Decimal
    total_spent: Decimal
    remaining_budget: Decimal
    budget_utilization_pct: float
    is_over_budget: bool
    total_activities: int
    total_expenses_count: int
    total_reports_count: int


class OwnerCategoryExpense(BaseModel):
    category: str
    total_amount: Decimal
    count: int
    percentage: float


class OwnerSpendingTrend(BaseModel):
    period: str  # e.g. "2026-07"
    total_spent: Decimal
    count: int


class OwnerTripStatusDistribution(BaseModel):
    status: str  # "upcoming", "ongoing", "completed"
    count: int
    percentage: float


class OwnerUpcomingTrip(BaseModel):
    id: UUID
    title: str
    destination: str
    start_date: date
    end_date: date
    budget: Decimal
    total_spent: Decimal
    remaining_budget: Decimal
    percent_spent: float
    activity_count: int
    days_until_start: int
    status: str


class OwnerRecentActivity(BaseModel):
    id: UUID
    trip_id: UUID
    trip_title: str
    title: str
    location: Optional[str] = None
    activity_date: date
    cost: Decimal
    description: Optional[str] = None
    start_time: Optional[time] = None
    duration_minutes: Optional[int] = None


class OwnerRecentExpense(BaseModel):
    id: UUID
    trip_id: UUID
    trip_title: str
    title: str
    amount: Decimal
    category: str
    expense_date: date
    description: Optional[str] = None


class OwnerReportHistoryItem(BaseModel):
    task_id: str
    trip_id: UUID
    trip_title: str
    filename: str
    file_size: int
    generated_at: str
    download_url: str


class OwnerDashboardResponse(BaseModel):
    overview: OwnerDashboardOverview
    category_expenses: List[OwnerCategoryExpense]
    spending_trends: List[OwnerSpendingTrend]
    trip_status_distribution: List[OwnerTripStatusDistribution]
    upcoming_trips: List[OwnerUpcomingTrip]
    recent_activities: List[OwnerRecentActivity]
    recent_expenses: List[OwnerRecentExpense]
    reports_history: List[OwnerReportHistoryItem]


class PaginatedOwnerActivities(BaseModel):
    items: List[OwnerRecentActivity]
    total: int
    page: int
    page_size: int
    total_pages: int


class PaginatedOwnerExpenses(BaseModel):
    items: List[OwnerRecentExpense]
    total: int
    page: int
    page_size: int
    total_pages: int

