"""Converting a confirmed inquiry into a trip through the existing trip service."""

from datetime import date
from uuid import UUID

from app.models.customer import Inquiry
from app.models.trip import Trip
from tests.crm_helpers import API, confirm, conversion_body, make_customer, make_inquiry, move


def confirmed_inquiry(client, headers, **overrides):
    customer = make_customer(client, headers)
    inquiry = make_inquiry(client, headers, customer["id"], **overrides)
    confirm(client, headers, inquiry["id"])
    return customer, inquiry


def test_converting_creates_a_trip_linked_to_the_customer_and_keeps_the_inquiry(planner_client, alice):
    customer, inquiry = confirmed_inquiry(planner_client, alice, follow_up_on="2027-03-15")
    response = planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice)
    assert response.status_code == 201, response.text
    body = response.json()

    trip = body["trip"]
    assert (trip["title"], trip["destination"], trip["start_date"], trip["end_date"], trip["budget"]) == (
        "Amina's Hunza trip", "Hunza Valley", "2027-06-01", "2027-06-08", 4500,
    )
    assert trip["customer_id"] == customer["id"]

    kept = body["inquiry"]
    assert kept["id"] == inquiry["id"] and kept["stage"] == "confirmed"
    assert kept["converted_trip_id"] == trip["id"] and kept["converted_at"]
    assert kept["allowed_stages"] == []
    assert kept["destination"] == "Hunza Valley" and len(kept["follow_ups"]) == 1  # nothing was removed
    assert kept["events"][0]["kind"] == "converted_to_trip"

    # It is an ordinary trip: owned by the user, listed, openable.
    fetched = planner_client.get(f"{API}/trips/{trip['id']}", headers=alice)
    assert fetched.status_code == 200 and fetched.json()["customer_id"] == customer["id"]
    assert [t["id"] for t in planner_client.get(f"{API}/trips", headers=alice).json()] == [trip["id"]]


def test_converting_twice_is_refused_and_creates_no_second_trip(planner_client, planner_db, alice):
    _, inquiry = confirmed_inquiry(planner_client, alice)
    url = f"{API}/inquiries/{inquiry['id']}/convert"
    assert planner_client.post(url, json=conversion_body(), headers=alice).status_code == 201
    again = planner_client.post(url, json=conversion_body(title="Second attempt"), headers=alice)
    assert again.status_code == 409 and "already" in again.json()["detail"]
    assert planner_db.query(Trip).count() == 1


def test_only_a_confirmed_inquiry_can_be_converted(planner_client, planner_db, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    for stage in ("new", "contacted", "planning", "quoted"):
        if stage != "new":
            move(planner_client, alice, inquiry["id"], stage)
        response = planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice)
        assert response.status_code == 409 and "confirmed" in response.json()["detail"].lower(), stage
    move(planner_client, alice, inquiry["id"], "closed_lost")
    assert planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice).status_code == 409
    assert planner_db.query(Trip).count() == 0


def test_conversion_needs_explicit_confirmation(planner_client, planner_db, alice):
    _, inquiry = confirmed_inquiry(planner_client, alice)
    url = f"{API}/inquiries/{inquiry['id']}/convert"
    without = conversion_body()
    del without["confirm"]
    for body in (without, conversion_body(confirm=False), conversion_body(confirm="yes please")):
        assert planner_client.post(url, json=body, headers=alice).status_code == 422, body
    assert planner_db.query(Trip).count() == 0
    assert planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).json()["converted_trip_id"] is None


def test_the_trip_is_validated_like_any_other_trip_and_nothing_is_half_saved(planner_client, planner_db, alice):
    _, inquiry = confirmed_inquiry(planner_client, alice)
    url = f"{API}/inquiries/{inquiry['id']}/convert"
    for overrides in (
        {"start_date": "2027-06-10", "end_date": "2027-06-01"},
        {"budget": 0},
        {"title": ""},
        {"title": "x" * 101},
        {"destination": ""},
    ):
        assert planner_client.post(url, json=conversion_body(**overrides), headers=alice).status_code == 422, overrides
    assert planner_db.query(Trip).count() == 0
    detail = planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).json()
    assert detail["converted_trip_id"] is None and detail["allowed_stages"] == ["quoted", "closed_lost"]


def test_a_converted_inquiry_is_final_and_cannot_be_deleted(planner_client, alice):
    _, inquiry = confirmed_inquiry(planner_client, alice)
    planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice)
    assert move(planner_client, alice, inquiry["id"], "closed_lost").status_code == 409
    assert move(planner_client, alice, inquiry["id"], "quoted").status_code == 409
    assert planner_client.delete(f"{API}/inquiries/{inquiry['id']}", headers=alice).status_code == 409
    # The brief can still be completed after the fact.
    assert planner_client.patch(f"{API}/inquiries/{inquiry['id']}", json={"notes": "Trip booked"}, headers=alice).status_code == 200


def test_existing_trips_are_never_overwritten(planner_client, planner_db, alice, alice_trip):
    before = (alice_trip.title, alice_trip.destination, alice_trip.start_date, alice_trip.end_date, float(alice_trip.budget))
    # Same title and dates as the existing trip: a new trip is created beside it, not merged into it.
    _, inquiry = confirmed_inquiry(planner_client, alice)
    response = planner_client.post(
        f"{API}/inquiries/{inquiry['id']}/convert",
        json=conversion_body(title=alice_trip.title, destination=alice_trip.destination,
                             start_date=alice_trip.start_date.isoformat(), end_date=alice_trip.end_date.isoformat()),
        headers=alice,
    )
    assert response.status_code == 201
    assert response.json()["trip"]["id"] != str(alice_trip.id)

    planner_db.refresh(alice_trip)
    assert (alice_trip.title, alice_trip.destination, alice_trip.start_date, alice_trip.end_date, float(alice_trip.budget)) == before
    assert alice_trip.customer_id is None
    assert planner_db.query(Trip).count() == 2


def test_personal_trips_still_work_without_a_customer(planner_client, alice):
    created = planner_client.post(
        f"{API}/trips",
        json={"title": "Solo", "destination": "Swat", "start_date": "2027-08-01", "end_date": "2027-08-05", "budget": 900},
        headers=alice,
    )
    assert created.status_code == 201 and created.json()["customer_id"] is None
    # A client can't attach a customer through the ordinary trip endpoints.
    customer = make_customer(planner_client, alice)
    forged = planner_client.post(
        f"{API}/trips",
        json={"title": "Solo", "destination": "Swat", "start_date": "2027-08-01", "end_date": "2027-08-05", "budget": 900,
              "customer_id": customer["id"]},
        headers=alice,
    )
    assert forged.status_code == 201 and forged.json()["customer_id"] is None
    patched = planner_client.patch(f"{API}/trips/{created.json()['id']}", json={"customer_id": customer["id"]}, headers=alice)
    assert patched.status_code in (200, 422) and patched.json().get("customer_id") is None


def test_another_owner_cannot_convert_and_nothing_leaks(planner_client, planner_db, alice, bob):
    _, inquiry = confirmed_inquiry(planner_client, alice)
    assert planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=bob).status_code == 404
    assert planner_db.query(Trip).count() == 0
    assert planner_client.get(f"{API}/trips", headers=bob).json() == []


def test_a_deleted_trip_frees_its_inquiry_to_be_converted_again(planner_client, planner_db, alice):
    _, inquiry = confirmed_inquiry(planner_client, alice)
    trip_id = planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice).json()["trip"]["id"]
    assert planner_client.delete(f"{API}/trips/{trip_id}", headers=alice).status_code == 204
    # SQLite does not enforce ON DELETE SET NULL; Postgres does, which is what this stands in for.
    row = planner_db.get(Inquiry, UUID(inquiry["id"]))
    row.converted_trip_id = None
    planner_db.commit()
    assert planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice).status_code == 201
