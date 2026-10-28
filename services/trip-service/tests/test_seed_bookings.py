"""The sample bookings must be valid, varied, and safe to seed repeatedly."""

from collections import Counter
from datetime import date, timedelta
from decimal import Decimal

import pytest

from app.models.booking import Booking, booking_documents
from app.models.document import TripDocument
from app.models.trip import Trip
from app.scripts import seed_bookings as seeder
from app.scripts import seed_documents as doc_seeder
from app.scripts.seed_bookings import build_fields
from app.scripts.seed_trips import _trip_id
from app.seeds.bookings_data import BOOKINGS
from app.seeds.documents_data import DOCUMENTS
from app.seeds.trips_data import TRIPS
from app.services.booking_rules import validate_booking
from tests.conftest import ALICE, BOB, auth_header

ALL = [(key, spec) for key, specs in BOOKINGS.items() for spec in specs]
TRIP_BY_KEY = {t["key"]: t for t in TRIPS}


def _fake_trip(key):
    spec = TRIP_BY_KEY[key]
    start = date(2027, 5, 1) + timedelta(days=spec["start"])
    return Trip(start_date=start, end_date=start + timedelta(days=spec["days"] - 1))


def test_bookings_belong_to_real_seed_trips_and_have_unique_keys():
    assert set(BOOKINGS) <= set(TRIP_BY_KEY)
    for key, specs in BOOKINGS.items():
        names = [s["key"] for s in specs]
        assert len(set(names)) == len(names), key


def test_the_set_covers_every_type_and_status_and_several_currencies():
    assert len(ALL) >= 25
    assert {s["type"] for _, s in ALL} == {"flight", "hotel", "transportation", "activity"}
    assert {s["status"] for _, s in ALL} == {"pending", "confirmed", "cancelled", "completed"}
    assert len({s["currency"] for _, s in ALL}) >= 4


@pytest.mark.parametrize("trip_key,spec", ALL, ids=[f"{k}:{s['key']}" for k, s in ALL])
def test_every_sample_booking_passes_the_real_rules(trip_key, spec):
    details, errors = validate_booking(build_fields(spec, _fake_trip(trip_key)))
    assert errors == [], errors
    assert details  # every type carries its details


def test_linked_documents_exist_in_the_sample_document_set():
    available = {(k, name) for k, docs in DOCUMENTS.items() for name, _, _ in docs}
    for key, spec in ALL:
        for name in spec["docs"]:
            assert (key, name) in available, (key, name)


def test_completed_bookings_belong_to_finished_trips():
    for key, spec in ALL:
        if spec["status"] == "completed":
            assert TRIP_BY_KEY[key]["start"] + TRIP_BY_KEY[key]["days"] <= 0, (key, spec["key"])


# ── Seeding ──────────────────────────────────────────────────────────────


@pytest.fixture
def seeded(planner_db, monkeypatch):
    for spec in TRIPS:
        start = date(2027, 5, 1) + timedelta(days=spec["start"])
        planner_db.add(Trip(id=_trip_id(ALICE, spec["key"]), user_id=ALICE, title=spec["title"], destination=spec["destination"],
                            start_date=start, end_date=start + timedelta(days=spec["days"] - 1), budget=Decimal(spec["budget"])))
    planner_db.commit()
    monkeypatch.setattr(seeder, "SessionLocal", lambda: planner_db)
    monkeypatch.setattr(doc_seeder, "SessionLocal", lambda: planner_db)
    return planner_db


def test_seeding_adds_everything_once(seeded, capsys):
    doc_seeder.seed_documents(ALICE)
    seeder.seed_bookings(ALICE)
    assert seeded.query(Booking).count() == len(ALL)
    seeder.seed_bookings(ALICE)
    assert seeded.query(Booking).count() == len(ALL)
    assert "0 added" in capsys.readouterr().out


def test_documents_are_linked_not_duplicated(seeded):
    doc_seeder.seed_documents(ALICE)
    before = seeded.query(TripDocument).count()
    seeder.seed_bookings(ALICE)
    expected_links = sum(len(s["docs"]) for _, s in ALL)
    assert seeded.execute(booking_documents.select()).all().__len__() == expected_links
    assert seeded.query(TripDocument).count() == before  # no new files were created


def test_seeding_works_without_the_sample_documents(seeded):
    seeder.seed_bookings(ALICE)
    assert seeded.query(Booking).count() == len(ALL)
    assert seeded.execute(booking_documents.select()).all() == []


def test_seeded_bookings_are_served_by_the_real_api(planner_client, seeded):
    doc_seeder.seed_documents(ALICE)
    seeder.seed_bookings(ALICE)
    data = planner_client.get("/api/v1/owner/bookings", params={"page_size": 50}, headers=auth_header(ALICE)).json()
    assert data["total"] == len(ALL)
    assert Counter(i["type"] for i in data["items"]) == Counter(s["type"] for _, s in ALL)
    assert any(i["documents"] for i in data["items"])
    summary = planner_client.get("/api/v1/owner/bookings/summary", headers=auth_header(ALICE)).json()
    assert summary["total"] == len(ALL) and len(summary["upcoming_cost"]) >= 1


def test_seeded_bookings_stay_private(planner_client, seeded):
    seeder.seed_bookings(ALICE)
    assert planner_client.get("/api/v1/owner/bookings", headers=auth_header(BOB)).json()["total"] == 0


def test_trips_that_were_not_seeded_are_skipped(planner_db, monkeypatch, capsys):
    monkeypatch.setattr(seeder, "SessionLocal", lambda: planner_db)
    seeder.seed_bookings(ALICE)
    assert planner_db.query(Booking).count() == 0 and "run seed_trips first" in capsys.readouterr().out


def test_remove_deletes_only_seeded_bookings_and_keeps_documents(planner_client, seeded):
    doc_seeder.seed_documents(ALICE)
    seeder.seed_bookings(ALICE)
    trip_id = _trip_id(ALICE, "dubai-desert-getaway")
    mine = planner_client.post(
        f"/api/v1/trips/{trip_id}/bookings", headers=auth_header(ALICE),
        json={"type": "activity", "title": "My own booking", "start_date": date(2027, 5, 6).isoformat()},
    ).json()
    docs_before = seeded.query(TripDocument).count()
    seeder.remove_seeded_bookings(ALICE)
    assert [b.title for b in seeded.query(Booking).all()] == [mine["title"]]
    assert seeded.query(TripDocument).count() == docs_before
