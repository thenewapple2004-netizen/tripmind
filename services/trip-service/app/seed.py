import sys
from datetime import date
from decimal import Decimal
from typing import List, Dict, Any

from app.core.database import SessionLocal
from app.models.trip import Trip

DEMO_TRIPS: List[Dict[str, Any]] = [
    {
        "title": "Kyoto Cultural Immersion",
        "destination": "Kyoto, Japan",
        "start_date": date(2026, 10, 10),
        "end_date": date(2026, 10, 20),
        "budget": Decimal("3200.00"),
    },
    {
        "title": "Swiss Alpine Expedition",
        "destination": "Zermatt, Switzerland",
        "start_date": date(2026, 12, 1),
        "end_date": date(2026, 12, 12),
        "budget": Decimal("4800.00"),
    },
    {
        "title": "Amalfi Coast Getaway",
        "destination": "Positano, Italy",
        "start_date": date(2027, 6, 5),
        "end_date": date(2027, 6, 15),
        "budget": Decimal("3900.00"),
    },
    {
        "title": "Safari in Serengeti",
        "destination": "Serengeti, Tanzania",
        "start_date": date(2027, 8, 12),
        "end_date": date(2027, 8, 22),
        "budget": Decimal("5600.00"),
    },
]


def seed_database() -> None:
    db = SessionLocal()
    try:
        created_count = 0
        skipped_count = 0

        for trip_data in DEMO_TRIPS:
            # Idempotent check: query by unique combination (title & destination)
            existing_trip = (
                db.query(Trip)
                .filter(
                    Trip.title == trip_data["title"],
                    Trip.destination == trip_data["destination"],
                )
                .first()
            )

            if existing_trip:
                print(f"Skipping existing trip: '{trip_data['title']}' ({trip_data['destination']})")
                skipped_count += 1
            else:
                new_trip = Trip(**trip_data)
                db.add(new_trip)
                print(f"Adding trip: '{trip_data['title']}' ({trip_data['destination']})")
                created_count += 1

        db.commit()
        print(f"\nSeeding complete: {created_count} created, {skipped_count} skipped.")
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
