from typing import List
from uuid import UUID
from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.checklist import ChecklistItem
from app.models.schemas import ChecklistItemCreate, ChecklistItemUpdate
from app.services.trip_service import trip_repository

MAX_ITEMS_PER_TRIP = 100


class ChecklistService:
    def _verify_trip(self, db: Session, trip_id: UUID, user_id: UUID):
        # 404 (not 403) for someone else's trip, so ids can't be probed.
        trip = trip_repository.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Trip with id '{trip_id}' not found or you do not have permission",
            )
        return trip

    def _get_item(self, db: Session, trip_id: UUID, item_id: UUID) -> ChecklistItem:
        item = (
            db.query(ChecklistItem)
            .filter(ChecklistItem.id == item_id, ChecklistItem.trip_id == trip_id)
            .first()
        )
        if not item:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Checklist item '{item_id}' not found for this trip",
            )
        return item

    def list_items(self, db: Session, trip_id: UUID, user_id: UUID) -> List[ChecklistItem]:
        self._verify_trip(db, trip_id, user_id)
        return (
            db.query(ChecklistItem)
            .filter(ChecklistItem.trip_id == trip_id)
            .order_by(ChecklistItem.position.asc(), ChecklistItem.created_at.asc(), ChecklistItem.id.asc())
            .all()
        )

    def create_item(self, db: Session, trip_id: UUID, user_id: UUID, data: ChecklistItemCreate) -> ChecklistItem:
        self._verify_trip(db, trip_id, user_id)
        count, last = (
            db.query(func.count(ChecklistItem.id), func.max(ChecklistItem.position))
            .filter(ChecklistItem.trip_id == trip_id)
            .one()
        )
        if count >= MAX_ITEMS_PER_TRIP:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"A trip can have at most {MAX_ITEMS_PER_TRIP} checklist items",
            )
        item = ChecklistItem(
            trip_id=trip_id,
            text=data.text,
            category=data.category,
            position=0 if last is None else last + 1,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def update_item(
        self, db: Session, trip_id: UUID, item_id: UUID, user_id: UUID, data: ChecklistItemUpdate
    ) -> ChecklistItem:
        self._verify_trip(db, trip_id, user_id)
        item = self._get_item(db, trip_id, item_id)
        for key in data.model_fields_set:
            setattr(item, key, getattr(data, key))
        db.commit()
        db.refresh(item)
        return item

    def delete_item(self, db: Session, trip_id: UUID, item_id: UUID, user_id: UUID) -> None:
        self._verify_trip(db, trip_id, user_id)
        db.delete(self._get_item(db, trip_id, item_id))
        db.commit()


checklist_service = ChecklistService()
