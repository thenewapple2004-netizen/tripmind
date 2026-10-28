"""
Seeds sample activities and expenses onto an owner's EXISTING trips so the Owner Portal
(Itinerary, Expenses, charts, calendar) has data to show during development.

It creates no trips and never touches other users' data. Rows get deterministic ids, so
running it again skips what is already there.

Usage (from the repo root, with the stack running):
    docker compose exec trip-service python -m app.scripts.seed_owner_data --user-id <uuid>
    docker compose exec trip-service python -m app.scripts.seed_owner_data --all-users
"""

import argparse
import sys
from datetime import timedelta
from decimal import Decimal
from typing import Any, Dict, List
from uuid import UUID, uuid5

from app.core import cache
from app.core.cache import get_budget_cache_key, get_owner_dashboard_cache_key
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.activity import Activity
from app.models.expense import Expense
from app.models.trip import Trip

NAMESPACE = UUID("7f1c1d2e-5b7a-4c3e-9a55-2f0d9c0b7e11")

# (title, description, fraction of the trip elapsed when it happens, cost as share of budget)
ACTIVITY_TEMPLATES = [
    ("Arrival and check-in", "Settle in and get a feel for the neighbourhood.", 0.0, 0.00),
    ("Guided walking tour", "Highlights of the old town with a local guide.", 0.2, 0.02),
    ("Local food tasting", "Market stalls and a signature regional dinner.", 0.4, 0.03),
    ("Day excursion", "A full day trip to a nearby landmark.", 0.6, 0.05),
    ("Museum and gallery visit", "Top-rated museum, tickets booked in advance.", 0.8, 0.015),
    ("Farewell dinner", "A relaxed last evening before departure.", 1.0, 0.03),
]

# (title, category, fraction of the trip elapsed, share of budget)
EXPENSE_TEMPLATES = [
    ("Accommodation deposit", "Accommodation", 0.0, 0.30),
    ("Flights / transfers", "Transportation", 0.0, 0.18),
    ("Groceries and street food", "Food", 0.3, 0.05),
    ("Restaurant dinner", "Food", 0.5, 0.04),
    ("Local transport pass", "Transportation", 0.2, 0.03),
    ("Tour tickets", "Activities", 0.6, 0.06),
    ("Souvenirs", "Shopping", 0.9, 0.03),
    ("Miscellaneous", "Other", 0.7, 0.015),
]


def _money(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"))


def _day_at(trip: Trip, fraction: float):
    span = (trip.end_date - trip.start_date).days
    return trip.start_date + timedelta(days=round(span * fraction))


def _plan_for(trip: Trip) -> Dict[str, List[Dict[str, Any]]]:
    place = trip.destination.split(",")[0].strip()
    budget = Decimal(trip.budget)
    activities = [
        {
            "id": uuid5(NAMESPACE, f"{trip.id}:activity:{title}"),
            "trip_id": trip.id,
            "title": title,
            "description": description,
            "location": place,
            "activity_date": _day_at(trip, fraction),
            "cost": _money(budget * Decimal(str(share))),
        }
        for title, description, fraction, share in ACTIVITY_TEMPLATES
    ]
    expenses = [
        {
            "id": uuid5(NAMESPACE, f"{trip.id}:expense:{title}"),
            "trip_id": trip.id,
            "title": title,
            "category": category,
            "expense_date": _day_at(trip, fraction),
            "amount": max(Decimal("1.00"), _money(budget * Decimal(str(share)))),
        }
        for title, category, fraction, share in EXPENSE_TEMPLATES
    ]
    return {"activities": activities, "expenses": expenses}


def seed_owner_data(user_id: UUID) -> None:
    env = settings.app_env.lower().strip()
    if env in ("production", "prod"):
        print(f"ABORTED: seeding is prohibited in '{env}' environment!", file=sys.stderr)
        sys.exit(1)

    db = SessionLocal()
    try:
        trips = db.query(Trip).filter(Trip.user_id == user_id).all()
        if not trips:
            print(f"No trips found for user {user_id}; nothing to seed.")
            return

        added_activities = added_expenses = 0
        for trip in trips:
            plan = _plan_for(trip)
            for row in plan["activities"]:
                if db.get(Activity, row["id"]) is None:
                    db.add(Activity(**row))
                    added_activities += 1
            for row in plan["expenses"]:
                if db.get(Expense, row["id"]) is None:
                    db.add(Expense(**row))
                    added_expenses += 1
        db.commit()

        # The owner dashboard and budget summaries are cached in Redis; drop the stale copies.
        cache.delete_cache(get_owner_dashboard_cache_key(user_id))
        for trip in trips:
            cache.delete_cache(get_budget_cache_key(user_id, trip.id))

        print(
            f"Seeded {len(trips)} trips for {user_id}: "
            f"{added_activities} activities and {added_expenses} expenses added."
        )
    except Exception as exc:
        db.rollback()
        print(f"Seeding failed and was rolled back: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--user-id", type=UUID, help="Owner's user id (from the auth service)")
    group.add_argument("--all-users", action="store_true", help="Seed every user that owns at least one trip")
    args = parser.parse_args()

    if args.all_users:
        with SessionLocal() as session:
            owners = [row[0] for row in session.query(Trip.user_id).filter(Trip.user_id.isnot(None)).distinct()]
        for owner in owners:
            seed_owner_data(owner)
    else:
        seed_owner_data(args.user_id)
