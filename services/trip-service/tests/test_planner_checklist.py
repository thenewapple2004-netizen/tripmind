from uuid import uuid4

import pytest

from app.services.checklist_service import MAX_ITEMS_PER_TRIP


def url(trip, item=None):
    base = f"/api/v1/trips/{trip.id}/checklist"
    return f"{base}/{item}" if item else base


def add(client, trip, headers, text="Passport", **extra):
    res = client.post(url(trip), json={"text": text, **extra}, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def test_create_and_list_in_order(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "Passport", category="documents")
    add(planner_client, alice_trip, alice, "Power bank", category="packing")
    add(planner_client, alice_trip, alice, "Book hotel", category="bookings")
    items = planner_client.get(url(alice_trip), headers=alice).json()
    assert [i["text"] for i in items] == ["Passport", "Power bank", "Book hotel"]
    assert [i["position"] for i in items] == [0, 1, 2]
    assert all(i["is_done"] is False for i in items)


def test_default_category_and_whitespace_is_tidied(planner_client, alice_trip, alice):
    item = add(planner_client, alice_trip, alice, "   Buy   travel\t insurance  ")
    assert item["text"] == "Buy travel insurance" and item["category"] == "other"


@pytest.mark.parametrize(
    "payload",
    [{"text": ""}, {"text": "   "}, {"text": "x" * 201}, {"text": "ok", "category": "nonsense"}, {"text": "ok", "is_done": True}, {}],
)
def test_create_validation(planner_client, alice_trip, alice, payload):
    assert planner_client.post(url(alice_trip), json=payload, headers=alice).status_code == 422


def test_toggle_edit_and_delete(planner_client, alice_trip, alice):
    item = add(planner_client, alice_trip, alice, "Visa")
    done = planner_client.patch(url(alice_trip, item["id"]), json={"is_done": True}, headers=alice).json()
    assert done["is_done"] is True and done["text"] == "Visa"
    edited = planner_client.patch(url(alice_trip, item["id"]), json={"text": "Visa (printed)", "category": "documents"}, headers=alice).json()
    assert edited["text"] == "Visa (printed)" and edited["category"] == "documents" and edited["is_done"] is True
    assert planner_client.delete(url(alice_trip, item["id"]), headers=alice).status_code == 204
    assert planner_client.get(url(alice_trip), headers=alice).json() == []


@pytest.mark.parametrize("payload", [{"text": None}, {"is_done": None}, {"category": "bad"}, {"text": " "}, {"trip_id": str(uuid4())}])
def test_update_validation(planner_client, alice_trip, alice, payload):
    item = add(planner_client, alice_trip, alice)
    assert planner_client.patch(url(alice_trip, item["id"]), json=payload, headers=alice).status_code == 422


def test_item_limit_per_trip(planner_client, alice_trip, alice, planner_db):
    from app.models.checklist import ChecklistItem

    planner_db.add_all([ChecklistItem(trip_id=alice_trip.id, text=f"i{n}", position=n) for n in range(MAX_ITEMS_PER_TRIP)])
    planner_db.commit()
    res = planner_client.post(url(alice_trip), json={"text": "one too many"}, headers=alice)
    assert res.status_code == 400 and "at most" in res.json()["detail"]


def test_items_are_scoped_to_their_trip(planner_client, make_trip, alice):
    one, two = make_trip(title="One"), make_trip(title="Two")
    item = add(planner_client, one, alice, "Only on trip one")
    assert planner_client.get(url(two), headers=alice).json() == []
    assert planner_client.patch(url(two, item["id"]), json={"is_done": True}, headers=alice).status_code == 404
    assert planner_client.delete(url(two, item["id"]), headers=alice).status_code == 404


def test_requires_authentication(planner_client, alice_trip):
    assert planner_client.get(url(alice_trip)).status_code == 401
    assert planner_client.post(url(alice_trip), json={"text": "x"}).status_code == 401


def test_other_users_cannot_touch_my_checklist(planner_client, alice_trip, alice, bob):
    item = add(planner_client, alice_trip, alice, "Private")
    assert planner_client.get(url(alice_trip), headers=bob).status_code == 404
    assert planner_client.post(url(alice_trip), json={"text": "sneaky"}, headers=bob).status_code == 404
    assert planner_client.patch(url(alice_trip, item["id"]), json={"is_done": True}, headers=bob).status_code == 404
    assert planner_client.delete(url(alice_trip, item["id"]), headers=bob).status_code == 404
    still = planner_client.get(url(alice_trip), headers=alice).json()
    assert [i["text"] for i in still] == ["Private"] and still[0]["is_done"] is False


def test_checklist_is_deleted_with_its_trip(planner_client, alice_trip, alice, planner_db):
    from app.models.checklist import ChecklistItem

    add(planner_client, alice_trip, alice)
    assert planner_client.delete(f"/api/v1/trips/{alice_trip.id}", headers=alice).status_code in (200, 204)
    planner_db.expire_all()
    assert planner_db.query(ChecklistItem).count() == 0
