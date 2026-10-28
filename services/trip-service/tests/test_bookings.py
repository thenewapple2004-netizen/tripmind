"""Booking & reservation management: CRUD, type-specific rules, documents, owner views, itinerary."""

import base64
from datetime import date, timedelta
from uuid import uuid4

import pytest

from app.models.booking import Booking, booking_documents
from app.models.document import TripDocument
from tests.conftest import ALICE, BOB, auth_header

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n"
START = date(2027, 5, 10)


def d(n: int, base: date = START) -> str:
    return (base + timedelta(days=n)).isoformat()


def flight(**over):
    body = {
        "type": "flight", "title": "Islamabad to Dubai", "provider": "Emirates", "confirmation_number": "ABC123",
        "start_date": d(0), "start_time": "08:15", "end_date": d(0), "end_time": "10:45",
        "total_cost": 420.5, "currency": "USD", "status": "confirmed",
        "details": {"flight_number": "ek 615", "departure_airport": "isb", "arrival_airport": "dxb"},
    }
    body.update(over)
    return body


def hotel(**over):
    body = {
        "type": "hotel", "title": "Serena Hotel", "provider": "Serena", "start_date": d(0), "start_time": "14:00",
        "end_date": d(3), "end_time": "11:00", "location": "Gilgit", "total_cost": 600, "status": "confirmed",
        "details": {"address": "Airport Road", "guests": 2},
    }
    body.update(over)
    return body


def transfer(**over):
    body = {
        "type": "transportation", "title": "Airport pickup", "start_date": d(0), "start_time": "11:00",
        "details": {"mode": "taxi", "pickup_location": "Islamabad Airport", "dropoff_location": "Hotel"},
    }
    body.update(over)
    return body


def tour(**over):
    body = {"type": "activity", "title": "Baltit Fort tour", "start_date": d(1), "start_time": "09:00",
            "details": {"participants": 2, "meeting_point": "Fort gate"}}
    body.update(over)
    return body


def url(trip, booking=None):
    base = f"/api/v1/trips/{trip.id}/bookings"
    return f"{base}/{booking}" if booking else base


def create(client, trip, headers, body):
    res = client.post(url(trip), json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def upload(client, trip, headers, name="ticket.pdf", kind="ticket"):
    res = client.post(f"/api/v1/trips/{trip.id}/documents", params={"filename": name, "kind": kind}, content=PDF, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def field_errors(res):
    return {e["loc"][-1]: e["msg"] for e in res.json()["detail"]}


# ── Create, read, update, delete ─────────────────────────────────────────


def test_create_and_read_each_booking_type(planner_client, alice_trip, alice):
    for body in (flight(), hotel(), transfer(), tour()):
        made = create(planner_client, alice_trip, alice, body)
        got = planner_client.get(url(alice_trip, made["id"]), headers=alice).json()
        assert got["type"] == body["type"] and got["title"] == body["title"] and got["trip_id"] == str(alice_trip.id)
    assert len(planner_client.get(url(alice_trip), headers=alice).json()) == 4


def test_details_are_normalised(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight())
    assert made["details"] == {"flight_number": "EK615", "departure_airport": "ISB", "arrival_airport": "DXB"}
    assert made["start_time"] == "08:15:00" and made["total_cost"] == 420.5 and made["currency"] == "USD"


def test_defaults_and_text_cleaning(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, tour(title="  Spaced   title ", provider="  ", notes="line1\nline2", status=None) | {"status": "pending"})
    assert made["title"] == "Spaced   title" and made["provider"] is None and made["notes"] == "line1\nline2"
    minimal = create(planner_client, alice_trip, alice, {"type": "activity", "title": "x", "start_date": d(0)})
    assert minimal["status"] == "pending" and minimal["total_cost"] == 0 and minimal["currency"] == "USD" and minimal["details"] == {}


def test_list_is_ordered_by_start(planner_client, alice_trip, alice):
    create(planner_client, alice_trip, alice, tour(title="later", start_date=d(2)))
    create(planner_client, alice_trip, alice, tour(title="earlier", start_date=d(0), start_time="07:00"))
    assert [b["title"] for b in planner_client.get(url(alice_trip), headers=alice).json()] == ["earlier", "later"]


def test_update_changes_only_what_is_sent(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight())
    res = planner_client.patch(url(alice_trip, made["id"]), json={"status": "cancelled", "cancellation_policy": "Non-refundable"}, headers=alice)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "cancelled" and body["cancellation_policy"] == "Non-refundable"
    assert body["title"] == made["title"] and body["details"] == made["details"] and body["total_cost"] == 420.5


def test_nullable_fields_can_be_cleared_but_required_ones_cannot(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight(notes="keep me"))
    cleared = planner_client.patch(url(alice_trip, made["id"]), json={"notes": None, "end_time": None, "provider": ""}, headers=alice).json()
    assert cleared["notes"] is None and cleared["end_time"] is None and cleared["provider"] is None
    for field in ("title", "status", "type", "start_date", "total_cost", "currency", "details"):
        assert planner_client.patch(url(alice_trip, made["id"]), json={field: None}, headers=alice).status_code == 422, field


def test_updating_details_replaces_them_and_revalidates(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight())
    ok = planner_client.patch(url(alice_trip, made["id"]), json={"details": {"flight_number": "PK305", "departure_airport": "LHE", "arrival_airport": "ISB", "seat": "12A"}}, headers=alice)
    assert ok.status_code == 200 and ok.json()["details"]["seat"] == "12A"
    bad = planner_client.patch(url(alice_trip, made["id"]), json={"details": {"flight_number": "PK305"}}, headers=alice)
    assert bad.status_code == 422 and "departure_airport" in field_errors(bad)


def test_switching_type_requires_that_types_details(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight())
    res = planner_client.patch(url(alice_trip, made["id"]), json={"type": "hotel"}, headers=alice)
    assert res.status_code == 422  # flight details don't belong on a hotel
    ok = planner_client.patch(url(alice_trip, made["id"]), json={"type": "hotel", "end_date": d(2), "end_time": None, "details": {"guests": 2}}, headers=alice)
    assert ok.status_code == 200 and ok.json()["type"] == "hotel" and ok.json()["details"] == {"guests": 2}


def test_a_partial_update_cannot_make_dates_inconsistent(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, hotel())
    res = planner_client.patch(url(alice_trip, made["id"]), json={"start_date": d(4)}, headers=alice)  # check-in after check-out
    assert res.status_code == 422 and "end_date" in field_errors(res)
    assert planner_client.get(url(alice_trip, made["id"]), headers=alice).json()["start_date"] == d(0)  # unchanged


def test_delete(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight())
    assert planner_client.delete(url(alice_trip, made["id"]), headers=alice).status_code == 204
    assert planner_client.get(url(alice_trip, made["id"]), headers=alice).status_code == 404
    assert planner_client.delete(url(alice_trip, made["id"]), headers=alice).status_code == 404


def test_unknown_booking_id_is_404(planner_client, alice_trip, alice):
    for call in (planner_client.get, planner_client.delete):
        assert call(url(alice_trip, uuid4()), headers=alice).status_code == 404
    assert planner_client.patch(url(alice_trip, uuid4()), json={"status": "confirmed"}, headers=alice).status_code == 404


# ── Validation ───────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "body,field",
    [
        (flight(details={"departure_airport": "ISB", "arrival_airport": "DXB"}), "flight_number"),
        (flight(details={"flight_number": "EK615", "arrival_airport": "DXB"}), "departure_airport"),
        (flight(details={"flight_number": "EK615", "departure_airport": "ISB"}), "arrival_airport"),
        (flight(details={"flight_number": "EK615", "departure_airport": "ISB", "arrival_airport": "ISB"}), "arrival_airport"),
        (flight(details={"flight_number": "EK615", "departure_airport": "ISLAM", "arrival_airport": "DXB"}), "departure_airport"),
        (flight(details={"flight_number": "EK615", "departure_airport": "I1B", "arrival_airport": "DXB"}), "departure_airport"),
        (flight(details={"flight_number": "NOTAFLIGHT", "departure_airport": "ISB", "arrival_airport": "DXB"}), "flight_number"),
        (flight(details={"flight_number": "EK615", "departure_airport": "ISB", "arrival_airport": "DXB", "cabin_class": "steerage"}), "cabin_class"),
        (hotel(end_date=None), "end_date"),
        (hotel(end_date=d(0)), "end_date"),
        (hotel(end_date=d(-1)), "end_date"),
        (hotel(details={"guests": 0}), "guests"),
        (hotel(details={"guests": 21}), "guests"),
        (transfer(details={"mode": "taxi", "dropoff_location": "Hotel"}), "pickup_location"),
        (transfer(details={"mode": "taxi", "pickup_location": "Airport"}), "dropoff_location"),
        (transfer(details={"mode": "hovercraft", "pickup_location": "A", "dropoff_location": "B"}), "mode"),
        (tour(details={"participants": 0}), "participants"),
        (flight(end_date=d(-1)), "end_date"),
        (flight(start_time="09:00", end_time="09:00"), "end_time"),
        (flight(start_time="09:00", end_time="08:00"), "end_time"),
        (hotel(free_cancellation_until=d(1)), "free_cancellation_until"),
    ],
)
def test_type_and_date_rules_name_the_field_at_fault(planner_client, alice_trip, alice, body, field):
    res = planner_client.post(url(alice_trip), json=body, headers=alice)
    assert res.status_code == 422, res.text
    assert field in field_errors(res), field_errors(res)


@pytest.mark.parametrize(
    "extra",
    [
        {"type": "boat"}, {"status": "maybe"}, {"title": ""}, {"title": "x" * 151}, {"total_cost": -1},
        {"total_cost": 100_000_000}, {"currency": "XXX"}, {"currency": "us"}, {"notes": "x" * 2001},
        {"confirmation_number": "x" * 61}, {"provider": "x" * 121}, {"location": "x" * 201},
        {"start_date": "not-a-date"}, {"start_time": "25:00"}, {"unknown_field": 1}, {"title": "bad\x00title"},
        {"title": "two\nlines"},
    ],
)
def test_field_validation(planner_client, alice_trip, alice, extra):
    assert planner_client.post(url(alice_trip), json=tour(**extra), headers=alice).status_code == 422


def test_details_for_another_type_are_rejected(planner_client, alice_trip, alice):
    res = planner_client.post(url(alice_trip), json=tour(details={"flight_number": "EK615"}), headers=alice)
    assert res.status_code == 422 and "flight_number" in field_errors(res)


def test_a_same_day_arrival_after_departure_is_fine_and_an_overnight_one_too(planner_client, alice_trip, alice):
    create(planner_client, alice_trip, alice, flight())
    create(planner_client, alice_trip, alice, flight(start_time="23:00", end_date=d(1), end_time="02:00"))


def test_bookings_may_fall_outside_the_trip_and_are_flagged(planner_client, alice_trip, alice):
    inside = create(planner_client, alice_trip, alice, flight())
    before = create(planner_client, alice_trip, alice, flight(start_date=d(-1), end_date=d(-1)))
    after = create(planner_client, alice_trip, alice, hotel(end_date=d(9)))
    assert (inside["outside_trip_dates"], before["outside_trip_dates"], after["outside_trip_dates"]) == (False, True, True)


# ── Ownership ────────────────────────────────────────────────────────────


def test_requires_authentication(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight())
    assert planner_client.get(url(alice_trip)).status_code == 401
    assert planner_client.post(url(alice_trip), json=flight()).status_code == 401
    assert planner_client.get(url(alice_trip, made["id"])).status_code == 401
    assert planner_client.patch(url(alice_trip, made["id"]), json={"status": "cancelled"}).status_code == 401
    assert planner_client.delete(url(alice_trip, made["id"])).status_code == 401
    for path in ("/api/v1/owner/bookings", "/api/v1/owner/bookings/summary"):
        assert planner_client.get(path).status_code == 401


def test_other_users_cannot_touch_my_bookings(planner_client, alice_trip, alice, bob):
    made = create(planner_client, alice_trip, alice, flight())
    assert planner_client.get(url(alice_trip), headers=bob).status_code == 404
    assert planner_client.post(url(alice_trip), json=flight(), headers=bob).status_code == 404
    assert planner_client.get(url(alice_trip, made["id"]), headers=bob).status_code == 404
    assert planner_client.patch(url(alice_trip, made["id"]), json={"status": "cancelled"}, headers=bob).status_code == 404
    assert planner_client.delete(url(alice_trip, made["id"]), headers=bob).status_code == 404
    still = planner_client.get(url(alice_trip, made["id"]), headers=alice).json()
    assert still["status"] == "confirmed"


def test_a_booking_id_only_works_under_its_own_trip(planner_client, make_trip, alice):
    one, two = make_trip(title="One"), make_trip(title="Two")
    made = create(planner_client, one, alice, flight())
    assert planner_client.get(url(two, made["id"]), headers=alice).status_code == 404
    assert planner_client.patch(url(two, made["id"]), json={"status": "cancelled"}, headers=alice).status_code == 404
    assert planner_client.delete(url(two, made["id"]), headers=alice).status_code == 404


def test_bookings_are_deleted_with_their_trip(planner_client, alice_trip, alice, planner_db):
    create(planner_client, alice_trip, alice, flight())
    assert planner_client.delete(f"/api/v1/trips/{alice_trip.id}", headers=alice).status_code in (200, 204)
    planner_db.expire_all()
    assert planner_db.query(Booking).count() == 0


# ── Linked documents ─────────────────────────────────────────────────────


def test_link_existing_documents_without_copying_them(planner_client, alice_trip, alice, planner_db):
    doc = upload(planner_client, alice_trip, alice)
    one = create(planner_client, alice_trip, alice, flight(document_ids=[doc["id"]]))
    two = create(planner_client, alice_trip, alice, hotel(document_ids=[doc["id"]]))
    for made in (one, two):
        assert [x["id"] for x in made["documents"]] == [doc["id"]]
        assert "data" not in made["documents"][0] and made["documents"][0]["filename"] == "ticket.pdf"
    assert planner_db.query(TripDocument).count() == 1  # one stored file, two bookings pointing at it
    assert planner_db.execute(booking_documents.select()).all().__len__() == 2


def test_documents_can_be_relinked_and_cleared(planner_client, alice_trip, alice):
    a, b = upload(planner_client, alice_trip, alice, "a.pdf"), upload(planner_client, alice_trip, alice, "b.pdf")
    made = create(planner_client, alice_trip, alice, flight(document_ids=[a["id"]]))
    swapped = planner_client.patch(url(alice_trip, made["id"]), json={"document_ids": [b["id"], a["id"]]}, headers=alice).json()
    assert [x["id"] for x in swapped["documents"]] == [b["id"], a["id"]] or {x["id"] for x in swapped["documents"]} == {a["id"], b["id"]}
    cleared = planner_client.patch(url(alice_trip, made["id"]), json={"document_ids": []}, headers=alice).json()
    assert cleared["documents"] == []
    kept = planner_client.patch(url(alice_trip, made["id"]), json={"title": "renamed"}, headers=alice).json()
    assert kept["documents"] == []


def test_updating_other_fields_leaves_links_alone(planner_client, alice_trip, alice):
    doc = upload(planner_client, alice_trip, alice)
    made = create(planner_client, alice_trip, alice, flight(document_ids=[doc["id"]]))
    res = planner_client.patch(url(alice_trip, made["id"]), json={"status": "completed"}, headers=alice).json()
    assert [x["id"] for x in res["documents"]] == [doc["id"]]


def test_duplicate_ids_link_once(planner_client, alice_trip, alice):
    doc = upload(planner_client, alice_trip, alice)
    made = create(planner_client, alice_trip, alice, flight(document_ids=[doc["id"], doc["id"]]))
    assert len(made["documents"]) == 1


def test_cannot_link_a_document_from_another_trip_or_owner(planner_client, make_trip, alice, bob, bob_trip, alice_trip):
    other_trip = make_trip(title="My other trip")
    mine_elsewhere = upload(planner_client, other_trip, alice)
    bobs = upload(planner_client, bob_trip, bob)
    for doc in (mine_elsewhere, bobs, {"id": str(uuid4())}):
        res = planner_client.post(url(alice_trip), json=flight(document_ids=[doc["id"]]), headers=alice)
        assert res.status_code == 404, res.text
    assert planner_client.get(url(alice_trip), headers=alice).json() == []  # nothing half-created


def test_a_bad_link_in_an_update_changes_nothing(planner_client, alice_trip, alice, bob_trip, bob):
    bobs = upload(planner_client, bob_trip, bob)
    made = create(planner_client, alice_trip, alice, flight())
    res = planner_client.patch(url(alice_trip, made["id"]), json={"title": "changed", "document_ids": [bobs["id"]]}, headers=alice)
    assert res.status_code == 404
    assert planner_client.get(url(alice_trip, made["id"]), headers=alice).json()["title"] == made["title"]


def test_at_most_ten_documents_per_booking(planner_client, alice_trip, alice):
    ids = [upload(planner_client, alice_trip, alice, f"d{n}.pdf")["id"] for n in range(11)]
    assert planner_client.post(url(alice_trip), json=flight(document_ids=ids), headers=alice).status_code == 422
    assert planner_client.post(url(alice_trip), json=flight(document_ids=ids[:10]), headers=alice).status_code == 201


def test_deleting_a_booking_keeps_its_documents(planner_client, alice_trip, alice, planner_db):
    doc = upload(planner_client, alice_trip, alice)
    made = create(planner_client, alice_trip, alice, flight(document_ids=[doc["id"]]))
    planner_client.delete(url(alice_trip, made["id"]), headers=alice)
    planner_db.expire_all()
    assert planner_db.query(TripDocument).count() == 1
    assert planner_db.execute(booking_documents.select()).all() == []
    assert planner_client.get(f"/api/v1/trips/{alice_trip.id}/documents/{doc['id']}/download", headers=alice).status_code == 200


def test_deleting_a_document_unlinks_it_but_keeps_the_booking(planner_client, alice_trip, alice, planner_db):
    doc = upload(planner_client, alice_trip, alice)
    made = create(planner_client, alice_trip, alice, flight(document_ids=[doc["id"]]))
    assert planner_client.delete(f"/api/v1/trips/{alice_trip.id}/documents/{doc['id']}", headers=alice).status_code == 204
    got = planner_client.get(url(alice_trip, made["id"]), headers=alice).json()
    assert got["documents"] == [] and got["title"] == made["title"]
    planner_db.expire_all()
    assert planner_db.execute(booking_documents.select()).all() == []


def test_linked_documents_still_require_ownership_to_download(planner_client, alice_trip, alice, bob):
    doc = upload(planner_client, alice_trip, alice)
    create(planner_client, alice_trip, alice, flight(document_ids=[doc["id"]]))
    assert planner_client.get(f"/api/v1/trips/{alice_trip.id}/documents/{doc['id']}/download", headers=bob).status_code == 404


# ── Owner-wide list: search, filters, sort, pagination ──────────────────


@pytest.fixture
def portfolio(planner_client, make_trip, alice):
    """Two trips and a spread of bookings, all Alice's."""
    kyoto, lisbon = make_trip(title="Kyoto Autumn", start=date(2027, 5, 10)), make_trip(title="Lisbon Weekend", start=date(2027, 6, 1))
    rows = [
        (kyoto, flight(title="ISB to KIX", provider="Qatar Airways", confirmation_number="QR7788", status="confirmed", total_cost=900, start_date=d(0))),
        (kyoto, hotel(title="Ryokan Sakura", provider="Sakura Inn", status="pending", total_cost=500, location="Gion, Kyoto")),
        (kyoto, transfer(title="Airport shuttle", status="cancelled", total_cost=40, details={"mode": "shuttle", "pickup_location": "KIX", "dropoff_location": "Hotel"})),
        (lisbon, flight(title="LIS flight", provider="TAP", confirmation_number="TP1234", status="confirmed", total_cost=300, currency="EUR", start_date=d(0, date(2027, 6, 1)), end_date=d(0, date(2027, 6, 1)),
                        details={"flight_number": "TP1234", "departure_airport": "LHR", "arrival_airport": "LIS"})),
        (lisbon, tour(title="Tram tour", status="completed", total_cost=25, start_date=d(1, date(2027, 6, 1)))),
    ]
    return kyoto, lisbon, [create(planner_client, trip, alice, body) for trip, body in rows]


def owner(client, headers, **params):
    res = client.get("/api/v1/owner/bookings", params=params, headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def titles(data):
    return [i["title"] for i in data["items"]]


def test_owner_list_spans_all_trips_and_carries_trip_info(planner_client, portfolio, alice):
    data = owner(planner_client, alice)
    assert data["total"] == 5 and data["page"] == 1
    assert {i["trip_title"] for i in data["items"]} == {"Kyoto Autumn", "Lisbon Weekend"}
    assert all(i["trip_destination"] for i in data["items"])


def test_owner_list_only_shows_my_bookings(planner_client, portfolio, bob_trip, alice, bob):
    create(planner_client, bob_trip, bob, tour(title="Bob's secret tour"))
    assert owner(planner_client, bob)["total"] == 1
    assert "Bob's secret tour" not in titles(owner(planner_client, alice))
    assert owner(planner_client, alice, trip_id=str(bob_trip.id))["total"] == 0  # can't peek by trip id


@pytest.mark.parametrize(
    "params,expected",
    [
        ({"type": "flight"}, {"ISB to KIX", "LIS flight"}),
        ({"type": "hotel"}, {"Ryokan Sakura"}),
        ({"status": "confirmed"}, {"ISB to KIX", "LIS flight"}),
        ({"status": "cancelled"}, {"Airport shuttle"}),
        ({"type": "flight", "status": "pending"}, set()),
        ({"q": "qatar"}, {"ISB to KIX"}),
        ({"q": "QR7788"}, {"ISB to KIX"}),
        ({"q": "gion"}, {"Ryokan Sakura"}),
        ({"q": "lisbon"}, {"LIS flight", "Tram tour"}),  # matches the trip title
        ({"q": "  tram  "}, {"Tram tour"}),
        ({"q": "nothing like this"}, set()),
    ],
)
def test_owner_list_filters_and_search(planner_client, portfolio, alice, params, expected):
    assert set(titles(owner(planner_client, alice, **params))) == expected


def test_search_treats_percent_and_underscore_literally(planner_client, portfolio, alice):
    assert owner(planner_client, alice, q="%")["total"] == 0
    assert owner(planner_client, alice, q="_")["total"] == 0


def test_filter_by_trip(planner_client, portfolio, alice):
    kyoto, lisbon, _ = portfolio
    assert owner(planner_client, alice, trip_id=str(kyoto.id))["total"] == 3
    assert owner(planner_client, alice, trip_id=str(lisbon.id))["total"] == 2


@pytest.mark.parametrize(
    "sort,first,last",
    [
        ("start_asc", "ISB to KIX", "Tram tour"),
        ("start_desc", "Tram tour", "ISB to KIX"),
        ("cost_desc", "ISB to KIX", "Tram tour"),
        ("cost_asc", "Tram tour", "ISB to KIX"),
        ("title_asc", "Airport shuttle", "Tram tour"),
    ],
)
def test_owner_list_sorting(planner_client, portfolio, alice, sort, first, last):
    got = titles(owner(planner_client, alice, sort=sort))
    assert got[0] == first and got[-1] == last


def test_scope_upcoming_and_past_follow_the_callers_date(planner_client, portfolio, alice):
    # On 2027-05-12: the Kyoto flight (5/10) is over; the Ryokan stays until 5/13; Lisbon is in June.
    upcoming = set(titles(owner(planner_client, alice, scope="upcoming", today="2027-05-12")))
    assert upcoming == {"Ryokan Sakura", "LIS flight"}  # not-over and pending/confirmed; the cancelled shuttle and completed tour are excluded
    past = set(titles(owner(planner_client, alice, scope="past", today="2027-05-12")))
    assert past == {"ISB to KIX", "Airport shuttle", "Tram tour"}
    later = set(titles(owner(planner_client, alice, scope="upcoming", today="2027-07-01")))
    assert later == set()


def test_pagination(planner_client, portfolio, alice):
    first = owner(planner_client, alice, page_size=2, page=1)
    third = owner(planner_client, alice, page_size=2, page=3)
    assert first["total"] == 5 and first["total_pages"] == 3 and len(first["items"]) == 2 and len(third["items"]) == 1
    seen = [t for p in (1, 2, 3) for t in titles(owner(planner_client, alice, page_size=2, page=p))]
    assert len(seen) == len(set(seen)) == 5  # no overlaps and nothing missing
    for bad in ({"page": 0}, {"page_size": 0}, {"page_size": 51}, {"sort": "random"}, {"type": "boat"}, {"scope": "never"}):
        assert planner_client.get("/api/v1/owner/bookings", params=bad, headers=alice).status_code == 422


def test_summary(planner_client, portfolio, alice):
    s = planner_client.get("/api/v1/owner/bookings/summary", params={"today": "2027-05-12"}, headers=alice).json()
    assert s["total"] == 5 and s["by_status"] == {"pending": 1, "confirmed": 2, "cancelled": 1, "completed": 1}
    assert s["by_type"] == {"flight": 2, "hotel": 1, "transportation": 1, "activity": 1}
    assert s["upcoming_count"] == 2
    assert s["upcoming_cost"] == [{"currency": "EUR", "total": 300.0}, {"currency": "USD", "total": 500.0}]  # never summed across currencies


def test_summary_is_scoped_to_the_owner(planner_client, portfolio, bob):
    s = planner_client.get("/api/v1/owner/bookings/summary", headers=bob).json()
    assert s["total"] == 0 and s["upcoming_cost"] == []


# ── Itinerary integration ────────────────────────────────────────────────


def itinerary(client, trip, headers):
    return client.get(f"/api/v1/trips/{trip.id}/itinerary", headers=headers).json()


def test_confirmed_bookings_appear_on_the_itinerary_as_events(planner_client, alice_trip, alice):
    create(planner_client, alice_trip, alice, flight())
    create(planner_client, alice_trip, alice, hotel())
    days = itinerary(planner_client, alice_trip, alice)["days"]
    first, fourth = days[0]["reservations"], days[3]["reservations"]
    assert [(r["label"], r["time"]) for r in first] == [("Departs", "08:15:00"), ("Arrives", "10:45:00"), ("Check-in", "14:00:00")]
    assert [(r["label"], r["title"]) for r in fourth] == [("Check-out", "Serena Hotel")]
    assert first[0]["type"] == "flight" and first[0]["booking_id"]


def test_only_confirmed_and_completed_bookings_are_shown(planner_client, alice_trip, alice):
    for status in ("pending", "cancelled"):
        create(planner_client, alice_trip, alice, flight(status=status, title=status))
    create(planner_client, alice_trip, alice, tour(status="completed", title="done tour"))
    shown = [r["title"] for day in itinerary(planner_client, alice_trip, alice)["days"] for r in day["reservations"]]
    assert shown == ["done tour"]


def test_bookings_never_change_activities(planner_client, alice_trip, alice):
    act = planner_client.post(f"/api/v1/trips/{alice_trip.id}/activities", json={"title": "Walk", "activity_date": d(0), "cost": 5}, headers=alice).json()
    before = itinerary(planner_client, alice_trip, alice)
    for body in (flight(), hotel(), transfer(status="confirmed"), tour(status="confirmed")):
        create(planner_client, alice_trip, alice, body)
    after = itinerary(planner_client, alice_trip, alice)
    assert [day["activities"] for day in after["days"]] == [day["activities"] for day in before["days"]]
    assert after["total_activities"] == before["total_activities"] == 1 and after["conflicts"] == before["conflicts"]
    assert planner_client.get(f"/api/v1/trips/{alice_trip.id}/activities", headers=alice).json() == [act]


def test_reservations_follow_status_changes(planner_client, alice_trip, alice):
    made = create(planner_client, alice_trip, alice, flight(status="pending"))
    count = lambda: sum(len(day["reservations"]) for day in itinerary(planner_client, alice_trip, alice)["days"])  # noqa: E731
    assert count() == 0
    planner_client.patch(url(alice_trip, made["id"]), json={"status": "confirmed"}, headers=alice)
    assert count() == 2
    planner_client.patch(url(alice_trip, made["id"]), json={"status": "cancelled"}, headers=alice)
    assert count() == 0


def test_reservations_outside_the_trip_are_reported_separately(planner_client, alice_trip, alice):
    create(planner_client, alice_trip, alice, flight(start_date=d(-1), end_date=d(-1), title="Night-before flight"))
    data = itinerary(planner_client, alice_trip, alice)
    assert all(day["reservations"] == [] for day in data["days"])
    assert [r["title"] for r in data["off_calendar_reservations"]] == ["Night-before flight", "Night-before flight"]
    assert {r["date"] for r in data["off_calendar_reservations"]} == {d(-1)}


def test_activity_bookings_and_transfers_become_single_or_paired_events(planner_client, alice_trip, alice):
    create(planner_client, alice_trip, alice, tour(status="confirmed"))
    create(planner_client, alice_trip, alice, transfer(status="confirmed", end_time="12:00"))
    days = itinerary(planner_client, alice_trip, alice)["days"]
    assert [(r["label"], r["title"]) for r in days[1]["reservations"]] == [("Reservation", "Baltit Fort tour")]
    assert [r["label"] for r in days[0]["reservations"]] == ["Pickup", "Drop-off"]


def test_other_users_cannot_see_reservations_through_the_itinerary(planner_client, alice_trip, alice, bob):
    create(planner_client, alice_trip, alice, flight())
    assert planner_client.get(f"/api/v1/trips/{alice_trip.id}/itinerary", headers=bob).status_code == 404
