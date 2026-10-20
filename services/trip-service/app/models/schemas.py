from decimal import Decimal
from datetime import date
from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, condecimal, model_validator


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

class ActivityBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=150, description="Title of the activity")
    description: Optional[str] = Field(None, max_length=1000, description="Notes/details about activity")
    location: Optional[str] = Field(None, max_length=150, description="Location of activity")
    activity_date: date = Field(..., description="Date of the activity")
    cost: float = Field(0.0, ge=0, description="Cost of the activity (must be >= 0)")


class ActivityCreate(ActivityBase):
    pass


class ActivityUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    location: Optional[str] = Field(None, max_length=150)
    activity_date: Optional[date] = None
    cost: Optional[float] = Field(None, ge=0)


class ActivityResponse(ActivityBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    trip_id: UUID


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

