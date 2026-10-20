from decimal import Decimal
from typing import Dict, List, Optional
from uuid import UUID
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.models.expense import Expense
from app.models.schemas import ExpenseCreate, ExpenseUpdate


class ExpenseRepository:
    def create(self, db: Session, trip_id: UUID, expense_in: ExpenseCreate) -> Expense:
        """Create a new expense for a trip within a transactional boundary."""
        expense = Expense(
            trip_id=trip_id,
            title=expense_in.title,
            amount=expense_in.amount,
            category=expense_in.category,
            expense_date=expense_in.expense_date,
            description=expense_in.description,
        )
        try:
            db.add(expense)
            db.commit()
            db.refresh(expense)
            return expense
        except Exception:
            db.rollback()
            raise

    def get_by_id(self, db: Session, trip_id: UUID, expense_id: UUID) -> Optional[Expense]:
        return (
            db.query(Expense)
            .filter(Expense.trip_id == trip_id, Expense.id == expense_id)
            .first()
        )

    def list_for_trip(
        self, db: Session, trip_id: UUID, category: Optional[str] = None
    ) -> List[Expense]:
        query = db.query(Expense).filter(Expense.trip_id == trip_id)
        if category:
            query = query.filter(Expense.category == category)
        return query.order_by(Expense.expense_date.desc(), Expense.id.desc()).all()

    def update(
        self, db: Session, trip_id: UUID, expense_id: UUID, expense_in: ExpenseUpdate
    ) -> Optional[Expense]:
        expense = self.get_by_id(db, trip_id, expense_id)
        if not expense:
            return None

        update_data = expense_in.model_dump(exclude_unset=True)
        try:
            for field, value in update_data.items():
                setattr(expense, field, value)
            db.commit()
            db.refresh(expense)
            return expense
        except Exception:
            db.rollback()
            raise

    def delete(self, db: Session, trip_id: UUID, expense_id: UUID) -> bool:
        expense = self.get_by_id(db, trip_id, expense_id)
        if not expense:
            return False

        try:
            db.delete(expense)
            db.commit()
            return True
        except Exception:
            db.rollback()
            raise

    def get_category_aggregation(self, db: Session, trip_id: UUID) -> List[Dict]:
        """SQL aggregation: SUM(amount), COUNT(id) GROUP BY category."""
        results = (
            db.query(
                Expense.category,
                func.coalesce(func.sum(Expense.amount), 0).label("total"),
                func.count(Expense.id).label("count"),
            )
            .filter(Expense.trip_id == trip_id)
            .group_by(Expense.category)
            .order_by(func.sum(Expense.amount).desc())
            .all()
        )
        return [
            {"category": row[0], "total": Decimal(str(row[1])), "count": row[2]}
            for row in results
        ]

    def get_total_spent(self, db: Session, trip_id: UUID) -> Decimal:
        """SQL aggregation: SUM(amount) for all trip expenses."""
        result = (
            db.query(func.coalesce(func.sum(Expense.amount), 0))
            .filter(Expense.trip_id == trip_id)
            .scalar()
        )
        return Decimal(str(result)) if result is not None else Decimal("0.00")

    def get_expense_count(self, db: Session, trip_id: UUID) -> int:
        return db.query(func.count(Expense.id)).filter(Expense.trip_id == trip_id).scalar() or 0


expense_repository = ExpenseRepository()
