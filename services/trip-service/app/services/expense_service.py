from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.models.expense import Expense
from app.models.schemas import (
    BudgetSummary,
    CategorySummary,
    ExpenseCreate,
    ExpenseUpdate,
)
from app.services.expense_repository import expense_repository
from app.services.trip_service import trip_repository


class ExpenseService:
    def create_expense(
        self, db: Session, trip_id: UUID, expense_in: ExpenseCreate, user_id: Optional[UUID] = None
    ) -> Optional[Expense]:
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return None

        if expense_in.expense_date < trip.start_date or expense_in.expense_date > trip.end_date:
            raise ValueError(
                f"Expense date {expense_in.expense_date} must be between trip start date "
                f"({trip.start_date}) and end date ({trip.end_date})"
            )

        return expense_repository.create(db, trip_id, expense_in)

    def list_expenses(
        self,
        db: Session,
        trip_id: UUID,
        user_id: Optional[UUID] = None,
        category: Optional[str] = None,
    ) -> Optional[List[Expense]]:
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return None
        return expense_repository.list_for_trip(db, trip_id, category=category)

    def get_expense(
        self, db: Session, trip_id: UUID, expense_id: UUID, user_id: Optional[UUID] = None
    ) -> Optional[Expense]:
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return None
        return expense_repository.get_by_id(db, trip_id, expense_id)

    def update_expense(
        self,
        db: Session,
        trip_id: UUID,
        expense_id: UUID,
        expense_in: ExpenseUpdate,
        user_id: Optional[UUID] = None,
    ) -> Optional[Expense]:
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return None

        if expense_in.expense_date:
            if expense_in.expense_date < trip.start_date or expense_in.expense_date > trip.end_date:
                raise ValueError(
                    f"Expense date {expense_in.expense_date} must be between trip start date "
                    f"({trip.start_date}) and end date ({trip.end_date})"
                )

        return expense_repository.update(db, trip_id, expense_id, expense_in)

    def delete_expense(
        self, db: Session, trip_id: UUID, expense_id: UUID, user_id: Optional[UUID] = None
    ) -> bool:
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return False
        return expense_repository.delete(db, trip_id, expense_id)

    def get_budget_summary(
        self, db: Session, trip_id: UUID, user_id: Optional[UUID] = None
    ) -> Optional[BudgetSummary]:
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return None

        budget = Decimal(str(trip.budget))
        total_spent = expense_repository.get_total_spent(db, trip_id)
        remaining_budget = budget - total_spent
        expense_count = expense_repository.get_expense_count(db, trip_id)

        percent_spent = (
            round(float((total_spent / budget) * 100), 2) if budget > 0 else 0.0
        )
        is_over_budget = total_spent > budget

        raw_categories = expense_repository.get_category_aggregation(db, trip_id)
        by_category = [
            CategorySummary(
                category=item["category"],
                total=item["total"],
                count=item["count"],
                percentage=round(float((item["total"] / total_spent) * 100), 2)
                if total_spent > 0
                else 0.0,
            )
            for item in raw_categories
        ]

        return BudgetSummary(
            budget=budget,
            total_spent=total_spent,
            remaining_budget=remaining_budget,
            percent_spent=percent_spent,
            is_over_budget=is_over_budget,
            expense_count=expense_count,
            by_category=by_category,
        )


expense_service = ExpenseService()
