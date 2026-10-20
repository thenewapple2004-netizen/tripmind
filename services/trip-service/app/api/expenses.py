from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import (
    BudgetSummary,
    ExpenseCreate,
    ExpenseResponse,
    ExpenseUpdate,
)
from app.services.expense_service import expense_service

router = APIRouter(prefix="/trips/{trip_id}/expenses", tags=["Expenses"])


@router.post("", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_expense(
    trip_id: UUID,
    expense_in: ExpenseCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Record an expense for a trip owned by the authenticated user."""
    try:
        expense = expense_service.create_expense(db, trip_id, expense_in, user_id=user_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )
    return expense


@router.get("", response_model=List[ExpenseResponse])
def list_expenses(
    trip_id: UUID,
    category: Optional[str] = Query(None, description="Filter expenses by category"),
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """List all expenses for a trip owned by the authenticated user."""
    expenses = expense_service.list_expenses(db, trip_id, user_id=user_id, category=category)
    if expenses is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )
    return expenses


@router.get("/summary", response_model=BudgetSummary)
def get_budget_summary(
    trip_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Get overall budget and category expense summary for a trip."""
    summary = expense_service.get_budget_summary(db, trip_id, user_id=user_id)
    if not summary:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Trip with id '{trip_id}' not found",
        )
    return summary


@router.get("/{expense_id}", response_model=ExpenseResponse)
def get_expense(
    trip_id: UUID,
    expense_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Retrieve a single expense from a trip owned by the authenticated user."""
    expense = expense_service.get_expense(db, trip_id, expense_id, user_id=user_id)
    if not expense:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found for trip '{trip_id}'",
        )
    return expense


@router.patch("/{expense_id}", response_model=ExpenseResponse)
def update_expense(
    trip_id: UUID,
    expense_id: UUID,
    expense_update: ExpenseUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Update an expense on a trip owned by the authenticated user."""
    try:
        updated = expense_service.update_expense(
            db, trip_id, expense_id, expense_update, user_id=user_id
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    if not updated:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found for trip '{trip_id}'",
        )
    return updated


@router.delete("/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_expense(
    trip_id: UUID,
    expense_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    """Delete an expense from a trip owned by the authenticated user."""
    deleted = expense_service.delete_expense(db, trip_id, expense_id, user_id=user_id)
    if not deleted:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Expense with id '{expense_id}' not found for trip '{trip_id}'",
        )
