"""
Seeds sample travel documents (PDFs and images, all stamped SAMPLE) onto the trips created by
`seed_trips`, so the Documents features can be tried straight away. Run `seed_trips` first.

Rows get deterministic ids, so running this again skips what already exists, and `--remove`
deletes exactly the documents it created.

Usage (from the repo root, with the stack running):
    docker compose exec trip-service python -m app.scripts.seed_documents --user-id <uuid>
    docker compose exec trip-service python -m app.scripts.seed_documents --all-users
    docker compose exec trip-service python -m app.scripts.seed_documents --user-id <uuid> --remove
"""

import argparse
import sys
from uuid import UUID, uuid5

from app.core.config import settings
from app.core.database import SessionLocal
from app.core.files import MAX_DOCUMENT_BYTES, sniff_document_type
from app.models.document import TripDocument
from app.models.trip import Trip
from app.scripts.seed_trips import NAMESPACE, _trip_id
from app.seeds.documents_data import DOCUMENTS


def _document_id(trip_id: UUID, filename: str) -> UUID:
    return uuid5(NAMESPACE, f"{trip_id}:document:{filename}")


def _guard() -> None:
    env = settings.app_env.lower().strip()
    if env in ("production", "prod"):
        print(f"ABORTED: seeding is prohibited in '{env}' environment!", file=sys.stderr)
        sys.exit(1)


def seed_documents(user_id: UUID) -> None:
    _guard()
    db = SessionLocal()
    try:
        added = skipped = missing = 0
        for key, docs in DOCUMENTS.items():
            trip_id = _trip_id(user_id, key)
            trip = db.get(Trip, trip_id)
            if trip is None or trip.user_id != user_id:
                missing += len(docs)  # the trip hasn't been seeded for this user
                continue
            for filename, kind, build in docs:
                doc_id = _document_id(trip_id, filename)
                if db.get(TripDocument, doc_id) is not None:
                    skipped += 1
                    continue
                data = build()
                content_type = sniff_document_type(data)
                assert content_type and len(data) <= MAX_DOCUMENT_BYTES, filename
                db.add(
                    TripDocument(
                        id=doc_id,
                        trip_id=trip_id,
                        filename=filename,
                        content_type=content_type,
                        size_bytes=len(data),
                        kind=kind,
                        data=data,
                    )
                )
                added += 1
        db.commit()
        note = f" ({missing} skipped: run seed_trips first)" if missing else ""
        print(f"Seeded documents for {user_id}: {added} added, {skipped} already present{note}.")
    except Exception as exc:
        db.rollback()
        print(f"Seeding failed and was rolled back: {exc}", file=sys.stderr)
        raise
    finally:
        db.close()


def remove_seeded_documents(user_id: UUID) -> None:
    _guard()
    db = SessionLocal()
    try:
        ids = [
            _document_id(_trip_id(user_id, key), filename)
            for key, docs in DOCUMENTS.items()
            for filename, _kind, _build in docs
        ]
        removed = db.query(TripDocument).filter(TripDocument.id.in_(ids)).delete(synchronize_session=False)
        db.commit()
        print(f"Removed {removed} seeded documents for {user_id}.")
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
    parser.add_argument("--remove", action="store_true", help="Delete the documents this script seeded")
    args = parser.parse_args()

    if args.all_users:
        with SessionLocal() as session:
            owners = [row[0] for row in session.query(Trip.user_id).filter(Trip.user_id.isnot(None)).distinct()]
    else:
        owners = [args.user_id]
    for owner in owners:
        (remove_seeded_documents if args.remove else seed_documents)(owner)
