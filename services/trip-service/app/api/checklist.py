from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.schemas import ChecklistItemCreate, ChecklistItemResponse, ChecklistItemUpdate
from app.services.checklist_service import checklist_service

router = APIRouter(prefix="/trips/{trip_id}/checklist", tags=["Checklist"])


@router.get("", response_model=List[ChecklistItemResponse])
def list_checklist(trip_id: UUID, db: Session = Depends(get_db), user_id: UUID = Depends(get_current_user_id)):
    return checklist_service.list_items(db, trip_id, user_id)


@router.post("", response_model=ChecklistItemResponse, status_code=status.HTTP_201_CREATED)
def create_checklist_item(
    trip_id: UUID,
    data: ChecklistItemCreate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return checklist_service.create_item(db, trip_id, user_id, data)


@router.patch("/{item_id}", response_model=ChecklistItemResponse)
def update_checklist_item(
    trip_id: UUID,
    item_id: UUID,
    data: ChecklistItemUpdate,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    return checklist_service.update_item(db, trip_id, item_id, user_id, data)


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_checklist_item(
    trip_id: UUID,
    item_id: UUID,
    db: Session = Depends(get_db),
    user_id: UUID = Depends(get_current_user_id),
):
    checklist_service.delete_item(db, trip_id, item_id, user_id)
    return None
