import csv
from datetime import datetime, timezone
import logging
import os
from uuid import UUID
from celery.exceptions import Ignore

from app.core.celery_app import celery_app
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.activity import Activity
from app.models.trip import Trip
from app.services.expense_repository import expense_repository
from app.services.expense_service import expense_service
from app.services.trip_service import trip_repository

logger = logging.getLogger(__name__)


class NonRetryableTaskError(Exception):
    """Exception raised for business validation errors that should not be retried."""
    pass


@celery_app.task(name="tasks.ping")
def ping_task() -> str:
    """Worker verification health task."""
    logger.info("Executing Celery worker ping task")
    return "pong"


@celery_app.task(
    bind=True,
    name="tasks.generate_trip_report",
    autoretry_for=(Exception,),
    dont_autoretry_for=(NonRetryableTaskError, ValueError),
    retry_kwargs={"max_retries": 3, "countdown": 5},
    retry_backoff=True,
    retry_backoff_max=30,
)
def generate_trip_report(self, trip_id: str, user_id: str) -> dict:
    """
    Generate a comprehensive CSV report for a trip containing:
    1. Trip metadata and dates
    2. Overall budget summary & remaining funds
    3. Category expense breakdown
    4. Scheduled activities list
    5. Itemized expenses ledger
    """
    task_id = self.request.id or f"manual_{datetime.now(timezone.utc).timestamp()}"
    logger.info(f"Starting trip report generation: trip_id={trip_id}, task_id={task_id}")

    db = SessionLocal()
    temp_file_path = None

    try:
        trip_uuid = UUID(trip_id)
        user_uuid = UUID(user_id)

        # 1. Fetch trip and verify ownership within database transaction
        trip = trip_repository.get_by_id(db, trip_uuid, user_id=user_uuid)
        if not trip:
            raise NonRetryableTaskError(
                f"Trip '{trip_id}' not found or unauthorized for user '{user_id}'"
            )

        # 2. Fetch budget summary aggregations
        budget_summary = expense_service.get_budget_summary(db, trip_uuid, user_id=user_uuid)

        # 3. Fetch activities
        activities = (
            db.query(Activity)
            .filter(Activity.trip_id == trip_uuid)
            .order_by(Activity.activity_date.asc(), Activity.id.asc())
            .all()
        )

        # 4. Fetch expenses
        expenses = expense_repository.list_for_trip(db, trip_uuid)

        # 5. Prepare destination paths
        os.makedirs(settings.reports_dir, exist_ok=True)
        filename = f"trip_report_{trip_id}_{task_id}.csv"
        final_file_path = os.path.join(settings.reports_dir, filename)
        temp_file_path = f"{final_file_path}.tmp"

        # 6. Generate formatted multi-section CSV
        with open(temp_file_path, mode="w", newline="", encoding="utf-8") as csvfile:
            writer = csv.writer(csvfile)

            # Section 1: Trip Metadata Header
            writer.writerow(["==============================================================="])
            writer.writerow(["TRIP DETAILS & SUMMARY REPORT"])
            writer.writerow(["==============================================================="])
            writer.writerow(["Trip Title", trip.title])
            writer.writerow(["Destination", trip.destination])
            writer.writerow(["Trip ID", str(trip.id)])
            writer.writerow(["Owner ID", str(trip.user_id)])
            writer.writerow(["Start Date", trip.start_date.isoformat()])
            writer.writerow(["End Date", trip.end_date.isoformat()])
            writer.writerow(["Generated At (UTC)", datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S")])
            writer.writerow([])

            # Section 2: Financial & Budget Overview
            writer.writerow(["==============================================================="])
            writer.writerow(["BUDGET OVERVIEW"])
            writer.writerow(["==============================================================="])
            writer.writerow(["Metric", "Value"])
            if budget_summary:
                writer.writerow(["Total Budget ($)", f"{budget_summary.budget:.2f}"])
                writer.writerow(["Total Spent ($)", f"{budget_summary.total_spent:.2f}"])
                writer.writerow(["Remaining Budget ($)", f"{budget_summary.remaining_budget:.2f}"])
                writer.writerow(["Percent Spent (%)", f"{budget_summary.percent_spent:.2f}%"])
                writer.writerow(["Budget Status", "OVER BUDGET" if budget_summary.is_over_budget else "WITHIN BUDGET"])
                writer.writerow(["Total Expense Transactions", budget_summary.expense_count])
            else:
                writer.writerow(["Total Budget ($)", f"{float(trip.budget):.2f}"])
                writer.writerow(["Total Spent ($)", "0.00"])
                writer.writerow(["Remaining Budget ($)", f"{float(trip.budget):.2f}"])
            writer.writerow([])

            # Section 3: Category Expense Breakdown
            writer.writerow(["==============================================================="])
            writer.writerow(["EXPENSES BY CATEGORY"])
            writer.writerow(["==============================================================="])
            writer.writerow(["Category", "Total Spent ($)", "Transaction Count", "Percentage of Total"])
            if budget_summary and budget_summary.by_category:
                for cat in budget_summary.by_category:
                    writer.writerow([
                        cat.category,
                        f"{cat.total:.2f}",
                        cat.count,
                        f"{cat.percentage:.2f}%",
                    ])
            else:
                writer.writerow(["No expenses recorded", "0.00", 0, "0.00%"])
            writer.writerow([])

            # Section 4: Activities Schedule
            writer.writerow(["==============================================================="])
            writer.writerow(["SCHEDULED ACTIVITIES"])
            writer.writerow(["==============================================================="])
            writer.writerow(["Activity Title", "Date", "Location", "Estimated Cost ($)", "Notes / Description"])
            if activities:
                for act in activities:
                    writer.writerow([
                        act.title,
                        act.activity_date.isoformat(),
                        act.location or "N/A",
                        f"{float(act.cost):.2f}",
                        act.description or "",
                    ])
            else:
                writer.writerow(["No activities scheduled", "-", "-", "0.00", ""])
            writer.writerow([])

            # Section 5: Itemized Expenses Ledger
            writer.writerow(["==============================================================="])
            writer.writerow(["ITEMIZED EXPENSES LEDGER"])
            writer.writerow(["==============================================================="])
            writer.writerow(["Expense Title", "Date", "Category", "Amount ($)", "Description / Notes"])
            if expenses:
                for exp in expenses:
                    writer.writerow([
                        exp.title,
                        exp.expense_date.isoformat(),
                        exp.category,
                        f"{exp.amount:.2f}",
                        exp.description or "",
                    ])
            else:
                writer.writerow(["No expenses recorded", "-", "-", "0.00", ""])

        # 7. Atomic rename from temporary file to final file (prevents partial reads)
        os.replace(temp_file_path, final_file_path)
        temp_file_path = None

        file_size = os.path.getsize(final_file_path)
        logger.info(
            f"Trip report generated successfully: {final_file_path} ({file_size} bytes)"
        )

        return {
            "task_id": task_id,
            "trip_id": str(trip.id),
            "user_id": str(user_id),
            "trip_title": trip.title,
            "filename": filename,
            "file_path": final_file_path,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "file_size": file_size,
            "row_counts": {
                "activities": len(activities),
                "expenses": len(expenses),
                "categories": len(budget_summary.by_category) if budget_summary else 0,
            },
        }

    except Exception as exc:
        if temp_file_path and os.path.exists(temp_file_path):
            try:
                os.remove(temp_file_path)
            except OSError:
                pass

        logger.error(f"Error generating trip report for trip '{trip_id}': {exc}", exc_info=True)
        raise

    finally:
        db.close()
