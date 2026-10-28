"""
Seeds sample bookings (flights, hotels, transfers and activity reservations) onto the trips created by
`seed_trips`, linking them to the sample documents from `seed_documents` where those exist.
Run `seed_trips` (and optionally `seed_documents`) first.

Rows get deterministic ids, so running this again skips what already exists, and `--remove`
deletes exactly the bookings it created. Linked documents are never touched.

Usage (from the repo root, with the stack running):
    docker compose exec trip-service python -m app.scripts.seed_bookings --user-id <uuid>
    docker compose exec trip-service python -m app.scripts.seed_bookings --all-users
    docker compose exec trip-service python -m app.scripts.seed_bookings --user-id <uuid> --remove
"""

import argparse
import sys
from datetime import time, timedelta
from decimal import Decimal
from uuid import UUID, uuid5

from app.core.config import settings
from app.core.database import SessionLocal
from app.models.booking import Booking
from app.models.document import TripDocument
from app.models.trip import Trip
from app.scripts.seed_documents import _document_id
from app.scripts.seed_trips import NAMESPACE, _trip_id
from app.seeds.bookings_data import BOOKINGS
from app.services.booking_rules import validate_booking


def _booking_id(trip_id: UUID, key: str) -> UUID:
    return uuid5(NAMESPACE, f"{trip_id}:booking:{key}")


def _guard() -> None:
    env = settings.app_env.lower().strip()
    if env in ("production", "prod"):
        print(f"ABORTED: seeding is prohibited in '{env}' environment!", file=sys.stderr)
        sys.exit(1)


def _t(value):
    return time.fromisoformat(value) if value else None


def build_fields(spec: dict, trip: Trip) -> dict:
    """The booking's real dates and values, relative to the trip it belongs to."""
    start = trip.start_date + timedelta(days=spec["start_day"])
    end_day = spec.get("end_day")
    free = spec.get("free_cancellation_day")
    return dict(
        type=spec["type"], status=spec["status"], title=spec["title"], provider=spec["provider"],
        confirmation_number=spec.get("confirmation_number"), start_date=start, start_time=_t(spec.get("start_time")),
        end_date=trip.start_date + timedelta(days=end_day) if end_day is not None else None,
        end_time=_t(spec.get("end_time")), location=spec.get("location"), total_cost=spec["total_cost"],
        currency=spec["currency"], notes=spec.get("notes"), cancellation_policy=spec.get("cancellation_policy"),
        free_cancellation_until=start + timedelta(days=free) if free is not None else None, details=spec["details"],
    )


def seed_bookings(user_id: UUID) -> None:
    _guard()
    db = SessionLocal()
    try:
        added = linked = skipped = missing = 0
        for trip_key, specs in BOOKINGS.items():
            trip_id = _trip_id(user_id, trip_key)
            trip = db.get(Trip, trip_id)
            if trip is None or trip.user_id != user_id:
                missing += len(specs)
                continue
            for spec in specs:
                booking_id = _booking_id(trip_id, spec["key"])
                if db.get(Booking, booking_id) is not None:
                    skipped += 1
                    continue
                fields = build_fields(spec, trip)
                details, errors = validate_booking(fields)
                assert not errors, (trip_key, spec["key"], errors)  # the seed data must itself be valid
                fields["details"] = details
                fields["total_cost"] = Decimal(str(fields["total_cost"])).quantize(Decimal("0.01"))
                booking = Booking(id=booking_id, trip_id=trip_id, **fields)
                for filename in spec["docs"]:
                    doc = db.get(TripDocument, _document_id(trip_id, filename))
                    if doc is not None:
                        booking.documents.append(doc)
                        linked += 1
                db.add(booking)
                added += 1
        db.commit()
        note = f" ({missing} skipped: run seed_trips first)" if missing else ""
        print(f"Seeded bookings for {user_id}: {added} added, {skipped} already present, {linked} documents linked{note}.")
    except Exception as exc:
        db.rollback()
        print(f"Seeding failed and was rolled back: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


def remove_seeded_bookings(user_id: UUID) -> None:
    _guard()
    db = SessionLocal()
    try:
        removed = 0
        for trip_key, specs in BOOKINGS.items():
            trip_id = _trip_id(user_id, trip_key)
            for spec in specs:
                booking = db.get(Booking, _booking_id(trip_id, spec["key"]))
                if booking is not None:
                    db.delete(booking)  # the ORM also drops its document links; the documents stay
                    removed += 1
        db.commit()
        print(f"Removed {removed} seeded bookings for {user_id}.")
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
    parser.add_argument("--remove", action="store_true", help="Delete the bookings this script seeded")
    args = parser.parse_args()

    if args.all_users:
        with SessionLocal() as session:
            owners = [row[0] for row in session.query(Trip.user_id).filter(Trip.user_id.isnot(None)).distinct()]
    else:
        owners = [args.user_id]
    for owner in owners:
        (remove_seeded_bookings if args.remove else seed_bookings)(owner)
