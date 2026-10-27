import math
from datetime import date
from typing import List, Optional, Tuple
from uuid import UUID
from sqlalchemy import and_, or_
from sqlalchemy.orm import Session
from app.models.trip import Trip
from app.models.schemas import TripCreate, TripUpdate
from app.core import cache
from app.core.cache import get_budget_cache_key


class TripRepository:
    def create(self, db: Session, trip_in: TripCreate, user_id: Optional[UUID] = None) -> Trip:
        trip = Trip(
            user_id=user_id,
            title=trip_in.title,
            destination=trip_in.destination,
            start_date=trip_in.start_date,
            end_date=trip_in.end_date,
            budget=trip_in.budget,
        )
        db.add(trip)
        db.commit()
        db.refresh(trip)
        return trip

    def get_all(self, db: Session, user_id: Optional[UUID] = None) -> List[Trip]:
        query = db.query(Trip)
        if user_id:
            query = query.filter(Trip.user_id == user_id)
        return query.order_by(Trip.start_date.asc(), Trip.id.asc()).all()

    def get_paginated(
        self,
        db: Session,
        user_id: Optional[UUID] = None,
        search: Optional[str] = None,
        status: Optional[str] = None,
        sort_by: Optional[str] = None,
        order: Optional[str] = "asc",
        page: int = 1,
        page_size: int = 10,
        min_budget: Optional[float] = None,
        max_budget: Optional[float] = None,
        start_date_from: Optional[date] = None,
        start_date_to: Optional[date] = None,
    ) -> Tuple[List[Trip], int, int]:
        """Query trips with dynamic filtering, full-text ILIKE search, sorting, and pagination."""
        query = db.query(Trip)

        # Scoped strictly to authenticated user
        if user_id:
            query = query.filter(Trip.user_id == user_id)

        # 11.1 Server-side search with ILIKE across title and destination
        if search and search.strip():
            term = f"%{search.strip()}%"
            query = query.filter(
                or_(
                    Trip.title.ilike(term),
                    Trip.destination.ilike(term),
                )
            )

        # 11.2 Dynamic status and range filters
        today = date.today()
        if status and status != "all":
            status_clean = status.lower().strip()
            if status_clean == "upcoming":
                query = query.filter(Trip.start_date > today)
            elif status_clean == "ongoing":
                query = query.filter(and_(Trip.start_date <= today, Trip.end_date >= today))
            elif status_clean == "completed":
                query = query.filter(Trip.end_date < today)

        if min_budget is not None:
            query = query.filter(Trip.budget >= min_budget)
        if max_budget is not None:
            query = query.filter(Trip.budget <= max_budget)

        if start_date_from is not None:
            query = query.filter(Trip.start_date >= start_date_from)
        if start_date_to is not None:
            query = query.filter(Trip.start_date <= start_date_to)

        # 11.3 & 11.5 Total count before pagination limits
        total = query.count()

        # 11.4 Sorting with deterministic secondary order
        sort_key = (sort_by or "upcoming").lower().strip()
        is_desc = (order or "asc").lower().strip() == "desc"
        order_clauses = []

        if sort_key in ("upcoming", "date-asc", "start_date"):
            if sort_key == "start_date" and is_desc:
                order_clauses.append(Trip.start_date.desc())
            else:
                order_clauses.append(Trip.start_date.asc())
        elif sort_key in ("date-desc", "newest"):
            order_clauses.append(Trip.start_date.desc())
        elif sort_key in ("budget-desc", "budget-high"):
            order_clauses.append(Trip.budget.desc())
        elif sort_key in ("budget-asc", "budget-low"):
            order_clauses.append(Trip.budget.asc())
        elif sort_key in ("title", "title-asc"):
            order_clauses.append(Trip.title.asc())
        elif sort_key in ("title-desc",):
            order_clauses.append(Trip.title.desc())
        elif sort_key == "budget":
            order_clauses.append(Trip.budget.desc() if is_desc else Trip.budget.asc())
        else:
            order_clauses.append(Trip.start_date.asc())

        # Stable secondary ordering by id to prevent pagination shifts
        order_clauses.append(Trip.id.asc())
        query = query.order_by(*order_clauses)

        # 11.3 Pagination calculation: LIMIT and OFFSET
        safe_page = max(1, page)
        safe_size = max(1, min(100, page_size))
        total_pages = math.ceil(total / safe_size) if total > 0 else 1
        offset = (safe_page - 1) * safe_size

        items = query.offset(offset).limit(safe_size).all()
        return items, total, total_pages

    def get_by_id(self, db: Session, trip_id: UUID, user_id: Optional[UUID] = None) -> Optional[Trip]:
        query = db.query(Trip).filter(Trip.id == trip_id)
        if user_id:
            query = query.filter(Trip.user_id == user_id)
        return query.first()

    def update(self, db: Session, trip_id: UUID, trip_in: TripUpdate, user_id: Optional[UUID] = None) -> Optional[Trip]:
        trip = self.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return None

        update_data = trip_in.model_dump(exclude_unset=True)
        start_date = update_data.get("start_date", trip.start_date)
        end_date = update_data.get("end_date", trip.end_date)
        if end_date < start_date:
            raise ValueError("end_date cannot be earlier than start_date")

        if trip.activities:
            for act in trip.activities:
                if act.activity_date < start_date or act.activity_date > end_date:
                    raise ValueError(
                        f"Cannot adjust trip dates: activity '{act.title}' scheduled for {act.activity_date} falls outside the new range ({start_date} to {end_date})"
                    )

        if trip.expenses:
            for exp in trip.expenses:
                if exp.expense_date < start_date or exp.expense_date > end_date:
                    raise ValueError(
                        f"Cannot adjust trip dates: expense '{exp.title}' incurred on {exp.expense_date} falls outside the new range ({start_date} to {end_date})"
                    )

        for key, value in update_data.items():
            setattr(trip, key, value)

        db.commit()
        db.refresh(trip)

        if trip.user_id:
            cache.delete_cache(get_budget_cache_key(trip.user_id, trip.id))

        return trip

    def delete(self, db: Session, trip_id: UUID, user_id: Optional[UUID] = None) -> bool:
        trip = self.get_by_id(db, trip_id, user_id=user_id)
        if not trip:
            return False
        owner_id = trip.user_id
        db.delete(trip)
        db.commit()

        if owner_id:
            cache.delete_cache(get_budget_cache_key(owner_id, trip_id))

        return True


trip_repository = TripRepository()
