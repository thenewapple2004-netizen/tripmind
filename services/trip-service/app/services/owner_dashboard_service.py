"""
owner_dashboard_service.py
==========================
Service providing aggregated analytics and dashboard metrics for the TripMind Owner Portal.
- All data is strictly scoped to the authenticated owner (multi-tenant isolation).
- Uses PostgreSQL aggregations for performant queries across trips, expenses, and activities.
- Implements the Cache-Aside pattern via Redis for sub-millisecond dashboard reads.
- Provides paginated activities and expenses across the owner's portfolio.
"""

from datetime import date, datetime, timezone
from decimal import Decimal
import logging
import math
import os
from typing import Dict, List, Optional
from uuid import UUID

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core import cache
from app.core.cache import get_owner_dashboard_cache_key
from app.core.config import settings
from app.models.activity import Activity
from app.models.expense import Expense
from app.models.schemas import (
    OwnerCategoryExpense,
    OwnerDashboardOverview,
    OwnerDashboardResponse,
    OwnerRecentActivity,
    OwnerRecentExpense,
    OwnerReportHistoryItem,
    OwnerSpendingTrend,
    OwnerTripStatusDistribution,
    OwnerUpcomingTrip,
    PaginatedOwnerActivities,
    PaginatedOwnerExpenses,
)
from app.models.trip import Trip

logger = logging.getLogger(__name__)


class OwnerDashboardService:
    def invalidate_cache(self, user_id: Optional[UUID]) -> None:
        """Invalidate the cached owner dashboard for a given user."""
        if not user_id:
            return
        key = get_owner_dashboard_cache_key(user_id)
        cache.delete_cache(key)

    def get_owner_dashboard(self, db: Session, user_id: UUID) -> OwnerDashboardResponse:
        """
        Fetch aggregated owner dashboard metrics.
        Implements Cache-Aside pattern: checks Redis first; on miss computes via PostgreSQL.
        """
        cache_key = get_owner_dashboard_cache_key(user_id)
        cached_json = cache.get_cache(cache_key)
        if cached_json:
            try:
                return OwnerDashboardResponse.model_validate_json(cached_json)
            except Exception as exc:
                logger.warning("Failed to deserialize cached owner dashboard for %s: %s", user_id, exc)

        today = date.today()

        # 1. Fetch all trips for owner
        trips = (
            db.query(Trip)
            .filter(Trip.user_id == user_id)
            .order_by(Trip.start_date.asc(), Trip.id.asc())
            .all()
        )
        trip_ids = [t.id for t in trips]
        trip_title_map = {t.id: t.title for t in trips}

        total_trips = len(trips)
        upcoming_trips_count = sum(1 for t in trips if t.start_date > today)
        ongoing_trips_count = sum(1 for t in trips if t.start_date <= today <= t.end_date)
        completed_trips_count = sum(1 for t in trips if t.end_date < today)
        total_budget = sum((Decimal(str(t.budget)) for t in trips), Decimal("0.00"))

        # 2. Aggregations across all owner's trips
        if trip_ids:
            total_spent_val = (
                db.query(func.coalesce(func.sum(Expense.amount), 0))
                .filter(Expense.trip_id.in_(trip_ids))
                .scalar()
            )
            total_spent = Decimal(str(total_spent_val)) if total_spent_val is not None else Decimal("0.00")

            total_expenses_count = (
                db.query(func.count(Expense.id))
                .filter(Expense.trip_id.in_(trip_ids))
                .scalar()
                or 0
            )

            total_activities = (
                db.query(func.count(Activity.id))
                .filter(Activity.trip_id.in_(trip_ids))
                .scalar()
                or 0
            )

            # 3. Category Expenses aggregation
            cat_rows = (
                db.query(
                    Expense.category,
                    func.coalesce(func.sum(Expense.amount), 0).label("total"),
                    func.count(Expense.id).label("count"),
                )
                .filter(Expense.trip_id.in_(trip_ids))
                .group_by(Expense.category)
                .order_by(func.sum(Expense.amount).desc())
                .all()
            )
            category_expenses = [
                OwnerCategoryExpense(
                    category=row[0],
                    total_amount=Decimal(str(row[1])),
                    count=row[2],
                    percentage=round(float((Decimal(str(row[1])) / total_spent) * 100), 2)
                    if total_spent > 0
                    else 0.0,
                )
                for row in cat_rows
            ]

            # 4. Spending Trends (grouped by month YYYY-MM)
            trend_rows = (
                db.query(
                    func.to_char(Expense.expense_date, "YYYY-MM").label("period"),
                    func.coalesce(func.sum(Expense.amount), 0).label("total"),
                    func.count(Expense.id).label("count"),
                )
                .filter(Expense.trip_id.in_(trip_ids))
                .group_by("period")
                .order_by("period")
                .all()
            )
            spending_trends = [
                OwnerSpendingTrend(
                    period=row[0],
                    total_spent=Decimal(str(row[1])),
                    count=row[2],
                )
                for row in trend_rows
            ]

            # 5. Recent Expenses (top 6)
            rec_exp_rows = (
                db.query(Expense, Trip.title)
                .join(Trip, Expense.trip_id == Trip.id)
                .filter(Trip.user_id == user_id)
                .order_by(Expense.expense_date.desc(), Expense.id.desc())
                .limit(6)
                .all()
            )
            recent_expenses = [
                OwnerRecentExpense(
                    id=exp.id,
                    trip_id=exp.trip_id,
                    trip_title=title,
                    title=exp.title,
                    amount=Decimal(str(exp.amount)),
                    category=exp.category,
                    expense_date=exp.expense_date,
                    description=exp.description,
                )
                for exp, title in rec_exp_rows
            ]

            # 6. Recent Activities (top 6)
            rec_act_rows = (
                db.query(Activity, Trip.title)
                .join(Trip, Activity.trip_id == Trip.id)
                .filter(Trip.user_id == user_id)
                .order_by(Activity.activity_date.desc(), Activity.id.desc())
                .limit(6)
                .all()
            )
            recent_activities = [
                OwnerRecentActivity(
                    id=act.id,
                    trip_id=act.trip_id,
                    trip_title=title,
                    title=act.title,
                    location=act.location,
                    activity_date=act.activity_date,
                    cost=Decimal(str(act.cost)),
                    description=act.description,
                )
                for act, title in rec_act_rows
            ]

            # 7. Upcoming / Active Trips with computed spend and activity count
            # Filter trips that are not completed (end_date >= today)
            active_trips = [t for t in trips if t.end_date >= today][:5]
            upcoming_trips: List[OwnerUpcomingTrip] = []
            for t in active_trips:
                t_spent = (
                    db.query(func.coalesce(func.sum(Expense.amount), 0))
                    .filter(Expense.trip_id == t.id)
                    .scalar()
                    or Decimal("0.00")
                )
                t_spent_dec = Decimal(str(t_spent))
                t_budget_dec = Decimal(str(t.budget))
                t_rem = t_budget_dec - t_spent_dec
                t_pct = (
                    round(float((t_spent_dec / t_budget_dec) * 100), 2)
                    if t_budget_dec > 0
                    else 0.0
                )
                t_acts = (
                    db.query(func.count(Activity.id))
                    .filter(Activity.trip_id == t.id)
                    .scalar()
                    or 0
                )
                days_until = (t.start_date - today).days if t.start_date > today else 0
                status_str = (
                    "upcoming"
                    if t.start_date > today
                    else ("ongoing" if t.end_date >= today else "completed")
                )

                upcoming_trips.append(
                    OwnerUpcomingTrip(
                        id=t.id,
                        title=t.title,
                        destination=t.destination,
                        start_date=t.start_date,
                        end_date=t.end_date,
                        budget=t_budget_dec,
                        total_spent=t_spent_dec,
                        remaining_budget=t_rem,
                        percent_spent=t_pct,
                        activity_count=t_acts,
                        days_until_start=days_until,
                        status=status_str,
                    )
                )

        else:
            total_spent = Decimal("0.00")
            total_expenses_count = 0
            total_activities = 0
            category_expenses = []
            spending_trends = []
            recent_expenses = []
            recent_activities = []
            upcoming_trips = []

        remaining_budget = total_budget - total_spent
        budget_utilization_pct = (
            round(float((total_spent / total_budget) * 100), 2) if total_budget > 0 else 0.0
        )
        is_over_budget = total_spent > total_budget

        # 8. Trip Status Distribution
        trip_status_distribution = [
            OwnerTripStatusDistribution(
                status="upcoming",
                count=upcoming_trips_count,
                percentage=round((upcoming_trips_count / total_trips) * 100, 1) if total_trips > 0 else 0.0,
            ),
            OwnerTripStatusDistribution(
                status="ongoing",
                count=ongoing_trips_count,
                percentage=round((ongoing_trips_count / total_trips) * 100, 1) if total_trips > 0 else 0.0,
            ),
            OwnerTripStatusDistribution(
                status="completed",
                count=completed_trips_count,
                percentage=round((completed_trips_count / total_trips) * 100, 1) if total_trips > 0 else 0.0,
            ),
        ]

        # 9. Reports History (scanned from reports directory for this owner's trips)
        reports_history = self._scan_owner_reports(trip_title_map)
        total_reports_count = len(reports_history)

        overview = OwnerDashboardOverview(
            total_trips=total_trips,
            upcoming_trips_count=upcoming_trips_count,
            ongoing_trips_count=ongoing_trips_count,
            completed_trips_count=completed_trips_count,
            total_budget=total_budget,
            total_spent=total_spent,
            remaining_budget=remaining_budget,
            budget_utilization_pct=budget_utilization_pct,
            is_over_budget=is_over_budget,
            total_activities=total_activities,
            total_expenses_count=total_expenses_count,
            total_reports_count=total_reports_count,
        )

        response = OwnerDashboardResponse(
            overview=overview,
            category_expenses=category_expenses,
            spending_trends=spending_trends,
            trip_status_distribution=trip_status_distribution,
            upcoming_trips=upcoming_trips,
            recent_activities=recent_activities,
            recent_expenses=recent_expenses,
            reports_history=reports_history,
        )

        # Store in Redis with 60-second TTL
        try:
            cache.set_cache(cache_key, response.model_dump_json(), ttl=60)
        except Exception as exc:
            logger.warning("Failed to cache owner dashboard for %s: %s", user_id, exc)

        return response

    def _scan_owner_reports(self, trip_title_map: Dict[UUID, str]) -> List[OwnerReportHistoryItem]:
        """Scan disk for CSV reports belonging to the specified owner trips."""
        items: List[OwnerReportHistoryItem] = []
        reports_dir = settings.reports_dir
        if not os.path.exists(reports_dir):
            return items

        try:
            for fname in os.listdir(reports_dir):
                if not (fname.startswith("trip_report_") and fname.endswith(".csv")):
                    continue
                # Expected format: trip_report_{trip_id}_{task_id}.csv
                name_without_ext = fname[:-4]
                parts = name_without_ext.split("_")
                if len(parts) >= 4:
                    raw_trip_id = parts[2]
                    task_id = "_".join(parts[3:])
                    try:
                        t_uuid = UUID(raw_trip_id)
                    except ValueError:
                        continue

                    if t_uuid in trip_title_map:
                        full_path = os.path.join(reports_dir, fname)
                        try:
                            stat = os.stat(full_path)
                            gen_time = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
                            items.append(
                                OwnerReportHistoryItem(
                                    task_id=task_id,
                                    trip_id=t_uuid,
                                    trip_title=trip_title_map[t_uuid],
                                    filename=fname,
                                    file_size=stat.st_size,
                                    generated_at=gen_time,
                                    download_url=f"/api/v1/trips/{t_uuid}/reports/{task_id}/download",
                                )
                            )
                        except OSError:
                            continue

            # Sort most recently generated first
            items.sort(key=lambda x: x.generated_at, reverse=True)
        except Exception as exc:
            logger.warning("Error scanning owner reports: %s", exc)

        return items

    def get_paginated_activities(
        self, db: Session, user_id: UUID, page: int = 1, page_size: int = 10
    ) -> PaginatedOwnerActivities:
        """Fetch paginated list of all activities across the owner's trips."""
        page = max(1, page)
        page_size = max(1, min(50, page_size))

        base_query = (
            db.query(Activity, Trip.title)
            .join(Trip, Activity.trip_id == Trip.id)
            .filter(Trip.user_id == user_id)
        )
        total = base_query.count()
        total_pages = math.ceil(total / page_size) if total > 0 else 1

        rows = (
            base_query.order_by(Activity.activity_date.desc(), Activity.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        items = [
            OwnerRecentActivity(
                id=act.id,
                trip_id=act.trip_id,
                trip_title=title,
                title=act.title,
                location=act.location,
                activity_date=act.activity_date,
                cost=Decimal(str(act.cost)),
                description=act.description,
            )
            for act, title in rows
        ]

        return PaginatedOwnerActivities(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )

    def get_paginated_expenses(
        self,
        db: Session,
        user_id: UUID,
        page: int = 1,
        page_size: int = 10,
        category: Optional[str] = None,
    ) -> PaginatedOwnerExpenses:
        """Fetch paginated list of all expenses across the owner's trips."""
        page = max(1, page)
        page_size = max(1, min(50, page_size))

        base_query = (
            db.query(Expense, Trip.title)
            .join(Trip, Expense.trip_id == Trip.id)
            .filter(Trip.user_id == user_id)
        )
        if category:
            base_query = base_query.filter(Expense.category == category)

        total = base_query.count()
        total_pages = math.ceil(total / page_size) if total > 0 else 1

        rows = (
            base_query.order_by(Expense.expense_date.desc(), Expense.id.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
            .all()
        )

        items = [
            OwnerRecentExpense(
                id=exp.id,
                trip_id=exp.trip_id,
                trip_title=title,
                title=exp.title,
                amount=Decimal(str(exp.amount)),
                category=exp.category,
                expense_date=exp.expense_date,
                description=exp.description,
            )
            for exp, title in rows
        ]

        return PaginatedOwnerExpenses(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=total_pages,
        )


owner_dashboard_service = OwnerDashboardService()
