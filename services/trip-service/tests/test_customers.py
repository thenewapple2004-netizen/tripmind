"""Customers: CRUD, validation, the directory's search / filters / sorting, history, and owner isolation."""

import json

from tests.conftest import auth_header, ALICE
from tests.crm_helpers import API, confirm, conversion_body, make_customer, make_inquiry


def test_create_and_read_a_customer(planner_client, alice):
    created = make_customer(
        planner_client, alice, "Amina Rahman", city="Lahore", country="Pakistan", preferred_contact="whatsapp",
        preferences="Prefers quiet guesthouses", notes="Referred by Sana",
    )
    assert created["name"] == "Amina Rahman"
    assert created["email"] == "amina@example.com"
    assert created["inquiries"] == [] and created["trips"] == [] and created["bookings"] == []

    fetched = planner_client.get(f"{API}/customers/{created['id']}", headers=alice).json()
    assert fetched["preferences"] == "Prefers quiet guesthouses"
    assert fetched["preferred_contact"] == "whatsapp"


def test_a_customer_needs_a_way_to_be_reached(planner_client, alice):
    response = planner_client.post(f"{API}/customers", json={"name": "No Contact"}, headers=alice)
    assert response.status_code == 422
    assert "email" in response.text.lower()


def test_email_is_lower_cased_and_unique_per_owner(planner_client, alice, bob):
    make_customer(planner_client, alice, "Amina Rahman", email="Amina@Example.com")
    duplicate = planner_client.post(
        f"{API}/customers", json={"name": "Someone Else", "email": "AMINA@example.com"}, headers=alice
    )
    assert duplicate.status_code == 422
    assert duplicate.json()["detail"][0]["loc"] == ["body", "email"]
    # Another owner can have a customer with the same email: books are separate.
    assert planner_client.post(
        f"{API}/customers", json={"name": "Amina Rahman", "email": "amina@example.com"}, headers=bob
    ).status_code == 201


def test_customers_without_an_email_never_collide(planner_client, alice):
    for name, phone in (("A One", "+44 20 7946 0958"), ("B Two", "+44 20 7946 0959")):
        assert planner_client.post(f"{API}/customers", json={"name": name, "phone": phone}, headers=alice).status_code == 201


def test_contact_fields_are_validated(planner_client, alice):
    bad = [
        {"name": "X", "email": "not-an-email"},
        {"name": "X", "phone": "abc"},
        {"name": "X", "phone": "123"},
        {"name": "   ", "email": "x@example.com"},
        {"name": "X", "email": "x@example.com", "preferred_contact": "pigeon"},
        {"name": "X", "email": "x@example.com", "unexpected": 1},
        {"name": "Line\nBreak", "email": "x@example.com"},
    ]
    for body in bad:
        assert planner_client.post(f"{API}/customers", json=body, headers=alice).status_code == 422, body


def test_update_changes_only_what_is_sent_and_can_clear_optional_fields(planner_client, alice):
    customer = make_customer(planner_client, alice, city="Lahore")
    response = planner_client.patch(f"{API}/customers/{customer['id']}", json={"city": None, "notes": "VIP"}, headers=alice)
    assert response.status_code == 200
    body = response.json()
    assert body["city"] is None and body["notes"] == "VIP" and body["email"] == customer["email"]
    assert planner_client.patch(f"{API}/customers/{customer['id']}", json={"name": None}, headers=alice).status_code == 422


def test_update_cannot_remove_the_last_contact_method_or_steal_an_email(planner_client, alice):
    first = make_customer(planner_client, alice, "First One", email="first@example.com", phone=None)
    second = make_customer(planner_client, alice, "Second One", email="second@example.com")
    assert planner_client.patch(f"{API}/customers/{first['id']}", json={"email": None}, headers=alice).status_code == 422
    assert planner_client.patch(f"{API}/customers/{second['id']}", json={"email": "first@example.com"}, headers=alice).status_code == 422
    # Saving a customer's own email again is fine.
    assert planner_client.patch(f"{API}/customers/{second['id']}", json={"email": "second@example.com"}, headers=alice).status_code == 200


def test_history_records_what_changed_without_copying_contact_details(planner_client, alice):
    customer = make_customer(planner_client, alice)
    planner_client.patch(f"{API}/customers/{customer['id']}", json={"phone": "+92 311 7654321", "email": "new@example.com"}, headers=alice)
    events = planner_client.get(f"{API}/customers/{customer['id']}/events", headers=alice).json()
    kinds = [e["kind"] for e in events["items"]]
    assert kinds == ["customer_updated", "customer_created"]
    blob = json.dumps(events)
    assert "7654321" not in blob and "new@example.com" not in blob and "1234567" not in blob
    assert "email" in events["items"][0]["summary"] and "phone" in events["items"][0]["summary"]


def test_notes_are_added_to_the_history(planner_client, alice):
    customer = make_customer(planner_client, alice)
    note = planner_client.post(f"{API}/customers/{customer['id']}/notes", json={"summary": "Called, wants Skardu in August"}, headers=alice)
    assert note.status_code == 201 and note.json()["kind"] == "note"
    assert planner_client.post(f"{API}/customers/{customer['id']}/notes", json={"summary": "  "}, headers=alice).status_code == 422
    events = planner_client.get(f"{API}/customers/{customer['id']}/events", headers=alice).json()
    assert events["items"][0]["summary"] == "Called, wants Skardu in August"


def test_archive_and_restore_with_the_active_filter(planner_client, alice):
    customer = make_customer(planner_client, alice)
    planner_client.patch(f"{API}/customers/{customer['id']}", json={"is_archived": True}, headers=alice)
    assert planner_client.get(f"{API}/customers", headers=alice).json()["total"] == 0
    assert planner_client.get(f"{API}/customers?status=archived", headers=alice).json()["total"] == 1
    assert planner_client.get(f"{API}/customers?status=all", headers=alice).json()["total"] == 1
    planner_client.patch(f"{API}/customers/{customer['id']}", json={"is_archived": False}, headers=alice)
    assert planner_client.get(f"{API}/customers", headers=alice).json()["total"] == 1
    kinds = [e["kind"] for e in planner_client.get(f"{API}/customers/{customer['id']}/events", headers=alice).json()["items"]]
    assert kinds[:2] == ["customer_restored", "customer_archived"]


def test_directory_search_sort_filter_and_paging(planner_client, alice):
    amina = make_customer(planner_client, alice, "Amina Rahman", city="Lahore", country="Pakistan")
    zed = make_customer(planner_client, alice, "Zed Walker", city="Leeds", country="UK", preferred_contact="email")
    make_customer(planner_client, alice, "Bilal Khan", city="Karachi", country="Pakistan", phone="+92 321 9998887")
    make_inquiry(planner_client, alice, amina["id"])

    def names(query):
        return [c["name"] for c in planner_client.get(f"{API}/customers?{query}", headers=alice).json()["items"]]

    assert names("") == ["Amina Rahman", "Bilal Khan", "Zed Walker"]
    assert names("sort=name_desc") == ["Zed Walker", "Bilal Khan", "Amina Rahman"]
    assert names("q=pakistan") == ["Amina Rahman", "Bilal Khan"]
    assert names("q=9998887") == ["Bilal Khan"]
    assert names("q=zed@example") == ["Zed Walker"]
    assert names("q=%25") == []  # a literal percent sign, not a wildcard
    assert names("has_open_inquiry=true") == ["Amina Rahman"]
    assert names("has_open_inquiry=false") == ["Bilal Khan", "Zed Walker"]
    assert names("preferred_contact=email") == ["Zed Walker"]
    assert names("sort=inquiries_desc")[0] == "Amina Rahman"
    assert names("sort=newest")[0] == "Bilal Khan"

    page = planner_client.get(f"{API}/customers?page_size=2&page=2", headers=alice).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and [c["name"] for c in page["items"]] == ["Zed Walker"]
    assert planner_client.get(f"{API}/customers?sort=bogus", headers=alice).status_code == 422
    assert zed["id"]


def test_directory_rows_carry_real_counts_and_the_next_follow_up(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"], follow_up_on="2027-03-15")
    make_inquiry(planner_client, alice, customer["id"], destination="Skardu")
    planner_client.post(f"{API}/inquiries/{inquiry['id']}/stage", json={"stage": "closed_lost"}, headers=alice)
    row = planner_client.get(f"{API}/customers", headers=alice).json()["items"][0]
    assert (row["total_inquiries"], row["open_inquiries"], row["trip_count"]) == (2, 1, 0)
    assert row["next_follow_up_on"] == "2027-03-15"


def test_customer_360_shows_inquiries_trips_bookings_and_follow_ups(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"], follow_up_on="2027-03-15")
    confirm(planner_client, alice, inquiry["id"])
    converted = planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice).json()
    trip_id = converted["trip"]["id"]
    booking = planner_client.post(
        f"{API}/trips/{trip_id}/bookings",
        json={"type": "hotel", "title": "Serena Hotel", "start_date": "2027-06-01", "end_date": "2027-06-04", "total_cost": 600},
        headers=alice,
    )
    assert booking.status_code == 201, booking.text

    detail = planner_client.get(f"{API}/customers/{customer['id']}", headers=alice).json()
    assert [i["destination"] for i in detail["inquiries"]] == ["Hunza Valley"]
    assert detail["trips"][0]["id"] == trip_id and detail["trips"][0]["booking_count"] == 1
    assert detail["trips"][0]["inquiry_id"] == inquiry["id"]
    assert detail["bookings"][0]["title"] == "Serena Hotel" and detail["bookings"][0]["trip_title"] == "Amina's Hunza trip"
    assert len(detail["follow_ups"]) == 1
    row = planner_client.get(f"{API}/customers", headers=alice).json()["items"][0]
    assert row["trip_count"] == 1 and row["open_inquiries"] == 0


def test_deleting_a_customer_removes_their_records_but_keeps_their_trips(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"], follow_up_on="2027-03-15")
    confirm(planner_client, alice, inquiry["id"])
    trip_id = planner_client.post(f"{API}/inquiries/{inquiry['id']}/convert", json=conversion_body(), headers=alice).json()["trip"]["id"]

    assert planner_client.delete(f"{API}/customers/{customer['id']}", headers=alice).status_code == 204
    assert planner_client.get(f"{API}/customers/{customer['id']}", headers=alice).status_code == 404
    assert planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).status_code == 404
    assert planner_client.get(f"{API}/follow-ups?view=all", headers=alice).json()["total"] == 0
    trip = planner_client.get(f"{API}/trips/{trip_id}", headers=alice)
    assert trip.status_code == 200 and trip.json()["customer_id"] is None


def test_everything_requires_authentication(planner_client):
    for method, path in (("get", "/customers"), ("post", "/customers"), ("get", "/inquiries"), ("get", "/follow-ups")):
        assert getattr(planner_client, method)(f"{API}{path}").status_code == 401


def test_customer_responses_are_not_cacheable(planner_client, alice):
    customer = make_customer(planner_client, alice)
    for path in ("/customers", f"/customers/{customer['id']}", "/inquiries", "/follow-ups"):
        assert planner_client.get(f"{API}{path}", headers=alice).headers["cache-control"] == "no-store"


def test_another_owner_cannot_see_or_change_a_customer(planner_client, alice, bob):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    cid = customer["id"]

    assert planner_client.get(f"{API}/customers", headers=bob).json()["total"] == 0
    assert planner_client.get(f"{API}/customers?q=amina", headers=bob).json()["total"] == 0
    for method, path, body in (
        ("get", f"/customers/{cid}", None),
        ("patch", f"/customers/{cid}", {"name": "Hacked"}),
        ("delete", f"/customers/{cid}", None),
        ("get", f"/customers/{cid}/events", None),
        ("post", f"/customers/{cid}/notes", {"summary": "hi"}),
    ):
        kwargs = {"json": body} if body else {}
        assert getattr(planner_client, method)(f"{API}{path}", headers=bob, **kwargs).status_code == 404, (method, path)

    # Bob can't attach an inquiry or a follow-up to Alice's customer either.
    attempt = planner_client.post(f"{API}/inquiries", json={"customer_id": cid, "destination": "X"}, headers=bob)
    assert attempt.status_code == 422
    attempt = planner_client.post(
        f"{API}/follow-ups", json={"title": "x", "due_date": "2027-03-10", "customer_id": cid}, headers=bob
    )
    assert attempt.status_code == 422
    # ...and none of that touched Alice's data.
    untouched = planner_client.get(f"{API}/customers/{cid}", headers=auth_header(ALICE)).json()
    assert untouched["name"] == "Amina Rahman" and len(untouched["inquiries"]) == 1 and untouched["inquiries"][0]["id"] == inquiry["id"]
