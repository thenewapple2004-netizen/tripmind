"""Follow-ups: scheduling, the Today / Upcoming / Overdue views, completion and isolation."""

from tests.crm_helpers import API, make_customer, make_inquiry

TODAY = "2027-03-10"


def make_follow_up(client, headers, **body):
    response = client.post(f"{API}/follow-ups?today={TODAY}", json=body, headers=headers)
    assert response.status_code == 201, response.text
    return response.json()


def test_follow_up_for_a_customer_and_for_an_inquiry(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"], destination="Skardu")

    for_customer = make_follow_up(planner_client, alice, title="Send brochure", due_date=TODAY, customer_id=customer["id"], notes="PDF")
    assert for_customer["customer"]["name"] == "Amina Rahman" and for_customer["inquiry_id"] is None
    assert for_customer["status"] == "today" and for_customer["notes"] == "PDF"

    for_inquiry = make_follow_up(planner_client, alice, title="Call back", due_date="2027-03-12", inquiry_id=inquiry["id"])
    assert for_inquiry["customer"]["id"] == customer["id"]  # taken from the inquiry
    assert for_inquiry["inquiry_destination"] == "Skardu" and for_inquiry["status"] == "upcoming"

    detail = planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).json()
    assert detail["next_follow_up_on"] == "2027-03-12" and detail["open_follow_ups"] == 1


def test_follow_up_validation(planner_client, alice):
    customer = make_customer(planner_client, alice)
    other = make_customer(planner_client, alice, "Bilal Khan")
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    bad = [
        {"title": "No subject", "due_date": TODAY},
        {"title": " ", "due_date": TODAY, "customer_id": customer["id"]},
        {"title": "No date", "customer_id": customer["id"]},
        {"title": "Bad date", "due_date": "1999-01-01", "customer_id": customer["id"]},
        {"title": "Wrong pair", "due_date": TODAY, "customer_id": other["id"], "inquiry_id": inquiry["id"]},
        {"title": "x", "due_date": TODAY, "customer_id": "00000000-0000-0000-0000-000000000000"},
        {"title": "x", "due_date": TODAY, "inquiry_id": "00000000-0000-0000-0000-000000000000"},
    ]
    for body in bad:
        assert planner_client.post(f"{API}/follow-ups", json=body, headers=alice).status_code == 422, body


def test_today_upcoming_and_overdue_views_use_the_callers_date(planner_client, alice):
    customer = make_customer(planner_client, alice)
    for title, due in (("Late", "2027-03-01"), ("Later", "2027-03-09"), ("Now", TODAY), ("Soon", "2027-03-11"), ("Far", "2027-04-30")):
        make_follow_up(planner_client, alice, title=title, due_date=due, customer_id=customer["id"])

    def titles(view, today=TODAY):
        return [f["title"] for f in planner_client.get(f"{API}/follow-ups?view={view}&today={today}", headers=alice).json()["items"]]

    assert titles("overdue") == ["Late", "Later"]
    assert titles("today") == ["Now"]
    assert titles("upcoming") == ["Soon", "Far"]
    assert titles("open") == ["Late", "Later", "Now", "Soon", "Far"]
    # The same data seen from another day: the buckets move, nothing is stored per day.
    assert titles("overdue", "2027-03-12") == ["Late", "Later", "Now", "Soon"]
    summary = planner_client.get(f"{API}/follow-ups/summary?today={TODAY}", headers=alice).json()
    assert summary == {"overdue": 2, "today": 1, "upcoming": 2}


def test_completing_reopening_editing_and_deleting(planner_client, alice):
    customer = make_customer(planner_client, alice)
    item = make_follow_up(planner_client, alice, title="Late", due_date="2027-03-01", customer_id=customer["id"])
    url = f"{API}/follow-ups/{item['id']}?today={TODAY}"

    done = planner_client.patch(url, json={"completed": True}, headers=alice).json()
    assert done["is_completed"] and done["status"] == "completed" and done["completed_at"]
    assert planner_client.get(f"{API}/follow-ups?view=overdue&today={TODAY}", headers=alice).json()["total"] == 0
    assert [f["id"] for f in planner_client.get(f"{API}/follow-ups?view=completed", headers=alice).json()["items"]] == [item["id"]]
    assert planner_client.get(f"{API}/follow-ups/summary?today={TODAY}", headers=alice).json()["overdue"] == 0

    reopened = planner_client.patch(url, json={"completed": False}, headers=alice).json()
    assert not reopened["is_completed"] and reopened["status"] == "overdue"

    edited = planner_client.patch(url, json={"title": "Call Amina", "due_date": "2027-03-20", "notes": None}, headers=alice).json()
    assert (edited["title"], edited["due_date"], edited["status"]) == ("Call Amina", "2027-03-20", "upcoming")
    assert planner_client.patch(url, json={"title": None}, headers=alice).status_code == 422

    kinds = [e["kind"] for e in planner_client.get(f"{API}/customers/{customer['id']}/events", headers=alice).json()["items"]]
    assert kinds[:3] == ["follow_up_reopened", "follow_up_completed", "follow_up_created"]

    assert planner_client.delete(f"{API}/follow-ups/{item['id']}", headers=alice).status_code == 204
    assert planner_client.delete(f"{API}/follow-ups/{item['id']}", headers=alice).status_code == 404


def test_filtering_by_customer_and_inquiry(planner_client, alice):
    one = make_customer(planner_client, alice)
    two = make_customer(planner_client, alice, "Bilal Khan")
    inquiry = make_inquiry(planner_client, alice, one["id"])
    make_follow_up(planner_client, alice, title="A", due_date=TODAY, customer_id=one["id"])
    make_follow_up(planner_client, alice, title="B", due_date=TODAY, inquiry_id=inquiry["id"])
    make_follow_up(planner_client, alice, title="C", due_date=TODAY, customer_id=two["id"])

    def titles(query):
        return sorted(f["title"] for f in planner_client.get(f"{API}/follow-ups?{query}", headers=alice).json()["items"])

    assert titles(f"customer_id={one['id']}") == ["A", "B"]
    assert titles(f"inquiry_id={inquiry['id']}") == ["B"]
    assert titles(f"customer_id={two['id']}") == ["C"]
    page = planner_client.get(f"{API}/follow-ups?page_size=2", headers=alice).json()
    assert page["total"] == 3 and page["total_pages"] == 2 and len(page["items"]) == 2


def test_another_owner_cannot_see_or_change_follow_ups(planner_client, alice, bob):
    customer = make_customer(planner_client, alice)
    item = make_follow_up(planner_client, alice, title="Private", due_date=TODAY, customer_id=customer["id"])
    url = f"{API}/follow-ups/{item['id']}"
    assert planner_client.get(f"{API}/follow-ups?view=all", headers=bob).json()["total"] == 0
    assert planner_client.get(f"{API}/follow-ups/summary?today={TODAY}", headers=bob).json() == {"overdue": 0, "today": 0, "upcoming": 0}
    assert planner_client.patch(url, json={"completed": True}, headers=bob).status_code == 404
    assert planner_client.delete(url, headers=bob).status_code == 404
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    attempt = planner_client.post(f"{API}/follow-ups", json={"title": "x", "due_date": TODAY, "inquiry_id": inquiry["id"]}, headers=bob)
    assert attempt.status_code == 422
    assert planner_client.get(f"{API}/follow-ups?view=all", headers=alice).json()["total"] == 1
