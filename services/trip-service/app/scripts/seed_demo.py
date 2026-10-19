import sys
from datetime import date
from decimal import Decimal
from typing import Any, Dict, List
from uuid import UUID

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.trip import Trip

# 5 realistic demo trips with fixed, deterministic, unique UUIDs
DEMO_TRIPS: List[Dict[str, Any]] = [
    {
        "id": UUID("11111111-1111-1111-1111-111111111111"),
        "title": "Kyoto Cultural Immersion",
        "destination": "Kyoto, Japan",
        "start_date": date(2026, 10, 10),
        "end_date": date(2026, 10, 20),
        "budget": Decimal("3200.00"),
    },
    {
        "id": UUID("22222222-2222-2222-2222-222222222222"),
        "title": "Swiss Alpine Expedition",
        "destination": "Zermatt, Switzerland",
        "start_date": date(2026, 12, 1),
        "end_date": date(2026, 12, 12),
        "budget": Decimal("4800.00"),
    },
    {
        "id": UUID("33333333-3333-3333-3333-333333333333"),
        "title": "Amalfi Coast Getaway",
        "destination": "Positano, Italy",
        "start_date": date(2027, 6, 5),
        "end_date": date(2027, 6, 15),
        "budget": Decimal("3900.00"),
    },
    {
        "id": UUID("44444444-4444-4444-4444-444444444444"),
        "title": "Safari in Serengeti",
        "destination": "Serengeti, Tanzania",
        "start_date": date(2027, 8, 12),
        "end_date": date(2027, 8, 22),
        "budget": Decimal("5600.00"),
    },
    {
        "id": UUID("55555555-5555-5555-5555-555555555555"),
        "title": "Patagonia Glaciers & Peaks",
        "destination": "El Chalten, Argentina",
        "start_date": date(2027, 11, 3),
        "end_date": date(2027, 11, 16),
        "budget": Decimal("4250.00"),
    },
]


def seed_demo_data() -> None:
    # Production guard: prevent running against production environment
    env = settings.app_env.lower().strip()
    if env in ["production", "prod"]:
        print(f"ABORTED: Seeding demo data is prohibited in '{env}' environment!", file=sys.stderr)
        sys.exit(1)

    print(f"Running seed_demo in '{env}' environment...")

    db = SessionLocal()
    try:
        created_count = 0
        skipped_count = 0

        # Run inside a single explicit database transaction
        with db.begin():
            for trip_data in DEMO_TRIPS:
                # Check whether each demo trip already exists by its fixed UUID or title+destination
                existing_trip = (
                    db.query(Trip)
                    .filter(
                        (Trip.id == trip_data["id"])
                        | (
                            (Trip.title == trip_data["title"])
                            & (Trip.destination == trip_data["destination"])
                        )
                    )
                    .first()
                )

                if existing_trip:
                    print(f"Skipping existing trip: '{trip_data['title']}' (ID: {existing_trip.id})")
                    skipped_count += 1
                else:
                    new_trip = Trip(**trip_data)
                    db.add(new_trip)
                    print(f"Adding trip: '{trip_data['title']}' (ID: {trip_data['id']})")
                    created_count += 1

        print(f"\nSeeding complete: {created_count} created, {skipped_count} skipped.")
    except Exception as e:
        db.rollback()
        print(f"Transaction failed and rolled back. Error: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_data()
