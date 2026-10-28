"""
Seeds sample trips (with activities and expenses) for an owner. The data lives in
`app/seeds/trips_data.py`: 25 trips, 15 of them in Pakistan's northern areas.

Rows get deterministic ids derived from the owner and the trip's key, so running this again
skips what already exists, and `--remove` deletes exactly what this script created.

Usage (from the repo root, with the stack running):
    docker compose exec trip-service python -m app.scripts.seed_trips --user-id <uuid>
    docker compose exec trip-service python -m app.scripts.seed_trips --all-users
    docker compose exec trip-service python -m app.scripts.seed_trips --user-id <uuid> --remove
"""

import argparse
import sys
from datetime import date, time, timedelta
from decimal import Decimal
from typing import List
from uuid import UUID, uuid5

from app.core import cache
from app.core.cache import get_budget_cache_key, get_owner_dashboard_cache_key
from app.core.config import settings
from app.core.database import SessionLocal
from app.models.activity import Activity
from app.models.expense import Expense
from app.models.trip import Trip
from app.seeds.trips_data import TRIPS, schedule_activities

NAMESPACE = UUID("3a9d5c0e-8b1f-4e57-a6c2-91d4f7b20c64")


def _trip_id(user_id: UUID, key: str) -> UUID:
    return uuid5(NAMESPACE, f"{user_id}:{key}")


def _guard() -> None:
    env = settings.app_env.lower().strip()
    if env in ("production", "prod"):
        print(f"ABORTED: seeding is prohibited in '{env}' environment!", file=sys.stderr)
        sys.exit(1)


def _invalidate(user_id: UUID, trip_ids: List[UUID]) -> None:
    """The owner dashboard and budget summaries are cached in Redis; drop the stale copies."""
    cache.delete_cache(get_owner_dashboard_cache_key(user_id))
    for trip_id in trip_ids:
        cache.delete_cache(get_budget_cache_key(user_id, trip_id))


def _as_time(value: str | None) -> time | None:
    return time.fromisoformat(value) if value else None


def _schedule_existing(db, trip_id: UUID, spec: dict, start: date) -> int:
    """Gives already-seeded activities their start time, duration and order if they don't have one yet
    (trips seeded before the planner existed). Only touches rows this script created."""
    updated = 0
    plan = schedule_activities(spec)
    for day, title, _location, _cost in spec["activities"]:
        activity = db.get(Activity, uuid5(NAMESPACE, f"{trip_id}:activity:{day}:{title}"))
        if activity is None or activity.start_time is not None or activity.duration_minutes is not None:
            continue
        slot = plan[title]
        if slot["start_time"] is None and activity.position == slot["position"]:
            continue
        activity.start_time = _as_time(slot["start_time"])
        activity.duration_minutes = slot["duration_minutes"]
        activity.position = slot["position"]
        updated += 1
    return updated


def seed_trips(user_id: UUID, today: date | None = None) -> None:
    _guard()
    today = today or date.today()
    db = SessionLocal()
    try:
        added = {"trips": 0, "activities": 0, "expenses": 0, "scheduled": 0}
        trip_ids: List[UUID] = []

        for spec in TRIPS:
            trip_id = _trip_id(user_id, spec["key"])
            trip_ids.append(trip_id)
            start = today + timedelta(days=spec["start"])

            if db.get(Trip, trip_id) is None:
                db.add(
                    Trip(
                        id=trip_id,
                        user_id=user_id,
                        title=spec["title"],
                        destination=spec["destination"],
                        start_date=start,
                        end_date=start + timedelta(days=spec["days"] - 1),
                        budget=Decimal(spec["budget"]).quantize(Decimal("0.01")),
                    )
                )
                added["trips"] += 1
            else:
                # Already seeded earlier: don't duplicate it, but make sure its activities are scheduled.
                trip = db.get(Trip, trip_id)
                added["scheduled"] += _schedule_existing(db, trip_id, spec, trip.start_date)
                continue

            plan = schedule_activities(spec)
            for day, title, location, cost in spec["activities"]:
                db.add(
                    Activity(
                        id=uuid5(NAMESPACE, f"{trip_id}:activity:{day}:{title}"),
                        trip_id=trip_id,
                        title=title,
                        location=location,
                        activity_date=start + timedelta(days=day),
                        cost=Decimal(cost).quantize(Decimal("0.01")),
                        start_time=_as_time(plan[title]["start_time"]),
                        duration_minutes=plan[title]["duration_minutes"],
                        position=plan[title]["position"],
                    )
                )
                added["activities"] += 1

            for day, title, category, amount in spec["expenses"]:
                db.add(
                    Expense(
                        id=uuid5(NAMESPACE, f"{trip_id}:expense:{day}:{title}"),
                        trip_id=trip_id,
                        title=title,
                        category=category,
                        expense_date=start + timedelta(days=day),
                        amount=Decimal(amount).quantize(Decimal("0.01")),
                    )
                )
                added["expenses"] += 1

        db.commit()
        _invalidate(user_id, trip_ids)
        print(
            f"Seeded {user_id}: {added['trips']} trips, {added['activities']} activities, "
            f"{added['expenses']} expenses added ({len(TRIPS) - added['trips']} trips already present), "
            f"{added['scheduled']} existing activities scheduled."
        )
    except Exception as exc:
        db.rollback()
        print(f"Seeding failed and was rolled back: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


def remove_seeded_trips(user_id: UUID) -> None:
    """Deletes only the trips this script created for the owner (activities and expenses cascade)."""
    _guard()
    db = SessionLocal()
    try:
        trip_ids = [_trip_id(user_id, spec["key"]) for spec in TRIPS]
        removed = db.query(Trip).filter(Trip.id.in_(trip_ids), Trip.user_id == user_id).delete(synchronize_session=False)
        db.commit()
        _invalidate(user_id, trip_ids)
        print(f"Removed {removed} seeded trips for {user_id}.")
    except Exception as exc:
        db.rollback()
        print(f"Removal failed and was rolled back: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--user-id", type=UUID, help="Owner's user id (from the auth service)")
    group.add_argument("--all-users", action="store_true", help="Seed every user that already owns a trip")
    parser.add_argument("--remove", action="store_true", help="Delete the trips this script seeded instead of adding them")
    args = parser.parse_args()

    if args.all_users:
        with SessionLocal() as session:
            owners = [row[0] for row in session.query(Trip.user_id).filter(Trip.user_id.isnot(None)).distinct()]
    else:
        owners = [args.user_id]
    for owner in owners:
        (remove_seeded_trips if args.remove else seed_trips)(owner)
