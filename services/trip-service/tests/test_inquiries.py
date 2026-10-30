"""Inquiries: creation, the pipeline's rules and history, the travel brief, editing, deletion and isolation."""

from tests.crm_helpers import API, confirm, conversion_body, make_customer, make_inquiry, move


def test_create_an_inquiry_with_a_brief_and_a_first_follow_up(planner_client, alice):
    customer = make_customer(planner_client, alice)
    brief = {"flexible_dates": True, "flexibility_days": 5, "travel_styles": ["nature", "nature", "photography"], "children": 1}
    inquiry = make_inquiry(
        planner_client, alice, customer["id"], date_from="2027-06-01", date_to="2027-06-10", travelers=4,
        budget_min=3000, budget_max=5000, currency="eur", source="referral", notes="Anniversary trip",
        brief=brief, follow_up_on="2027-03-15",
    )
    assert inquiry["stage"] == "new" and inquiry["currency"] == "EUR" and inquiry["source"] == "referral"
    assert inquiry["customer"] == {"id": customer["id"], "name": "Amina Rahman"}
    assert inquiry["brief"]["travel_styles"] == ["nature", "photography"]  # duplicates dropped
    assert inquiry["next_follow_up_on"] == "2027-03-15" and inquiry["open_follow_ups"] == 1
    assert inquiry["allowed_stages"] == ["contacted", "planning", "closed_lost"]
    assert [e["kind"] for e in inquiry["events"]] == ["follow_up_created", "inquiry_created"]


def test_inquiry_validation(planner_client, alice):
    customer = make_customer(planner_client, alice)
    base = {"customer_id": customer["id"], "destination": "Skardu"}
    bad = [
        {**base, "destination": " "},
        {**base, "travelers": 0},
        {**base, "date_from": "2027-06-10", "date_to": "2027-06-01"},
        {**base, "budget_min": 5000, "budget_max": 1000},
        {**base, "budget_max": -1},
        {**base, "currency": "XYZ"},
        {**base, "source": "carrier pigeon"},
        {**base, "brief": {"travel_styles": ["skydiving"]}},
        {**base, "brief": {"flexibility_days": 3}},  # needs flexible_dates
        {**base, "travelers": 2, "brief": {"children": 2}},  # no adult left
        {**base, "stage": "confirmed"},  # the stage is not settable on create
    ]
    for body in bad:
        assert planner_client.post(f"{API}/inquiries", json=body, headers=alice).status_code == 422, body


def test_an_inquiry_cannot_be_added_to_an_archived_customer(planner_client, alice):
    customer = make_customer(planner_client, alice)
    planner_client.patch(f"{API}/customers/{customer['id']}", json={"is_archived": True}, headers=alice)
    response = planner_client.post(f"{API}/inquiries", json={"customer_id": customer["id"], "destination": "X"}, headers=alice)
    assert response.status_code == 422 and "archived" in response.text


def test_stages_follow_the_pipeline_and_every_change_is_recorded(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    confirm(planner_client, alice, inquiry["id"])

    detail = planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).json()
    assert detail["stage"] == "confirmed" and detail["allowed_stages"] == ["quoted", "closed_lost"]
    changes = [(e["from_stage"], e["to_stage"]) for e in reversed(detail["events"]) if e["kind"] == "stage_changed"]
    assert changes == [("new", "contacted"), ("contacted", "planning"), ("planning", "quoted"), ("quoted", "confirmed")]
    # The customer's own timeline carries the same history.
    timeline = planner_client.get(f"{API}/customers/{customer['id']}/events", headers=alice).json()["items"]
    assert sum(e["kind"] == "stage_changed" for e in timeline) == 4


def test_a_move_the_pipeline_does_not_allow_is_refused_and_leaves_no_trace(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    for target in ("quoted", "confirmed"):
        response = move(planner_client, alice, inquiry["id"], target)
        assert response.status_code == 409
        assert "New" in response.json()["detail"] and "Contacted" in response.json()["detail"]
    detail = planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).json()
    assert detail["stage"] == "new" and [e["kind"] for e in detail["events"]] == ["inquiry_created"]
    assert move(planner_client, alice, inquiry["id"], "nonsense").status_code == 422


def test_moving_to_the_stage_it_is_already_in_changes_nothing(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    assert move(planner_client, alice, inquiry["id"], "new").status_code == 200
    assert len(planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).json()["events"]) == 1


def test_stepping_back_closing_and_reopening(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    assert move(planner_client, alice, inquiry["id"], "planning").status_code == 200
    assert move(planner_client, alice, inquiry["id"], "contacted").status_code == 200  # a step back

    closed = move(planner_client, alice, inquiry["id"], "closed_lost", reason="Chose another agency").json()
    assert closed["stage"] == "closed_lost" and closed["closed_reason"] == "Chose another agency"
    assert closed["allowed_stages"] == ["new"]
    assert "Chose another agency" in closed["events"][0]["summary"]
    assert move(planner_client, alice, inquiry["id"], "planning").status_code == 409  # closed can only reopen

    reopened = move(planner_client, alice, inquiry["id"], "new").json()
    assert reopened["stage"] == "new" and reopened["closed_reason"] is None


def test_a_confirmed_inquiry_can_still_fall_through(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    confirm(planner_client, alice, inquiry["id"])
    assert move(planner_client, alice, inquiry["id"], "closed_lost", reason="Visa refused").status_code == 200


def test_the_brief_is_editable_at_every_stage_and_replaced_as_a_whole(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"], travelers=4)
    first = {"accommodation_types": ["guesthouse"], "comfort_level": "midrange", "pace": "relaxed", "special_requests": "Vegetarian meals"}
    for stage in (None, "contacted", "planning", "quoted", "confirmed", "closed_lost"):
        if stage:
            assert move(planner_client, alice, inquiry["id"], stage).status_code == 200
        response = planner_client.patch(
            f"{API}/inquiries/{inquiry['id']}", json={"brief": {**first, "additional_notes": f"edited at {stage}"}}, headers=alice
        )
        assert response.status_code == 200, (stage, response.text)
        assert response.json()["brief"]["additional_notes"] == f"edited at {stage}"
    # Sending a brief replaces it: fields left out go back to empty.
    replaced = planner_client.patch(f"{API}/inquiries/{inquiry['id']}", json={"brief": {"pace": "fast"}}, headers=alice).json()
    assert replaced["brief"]["pace"] == "fast" and replaced["brief"]["accommodation_types"] == []
    events = [e["kind"] for e in replaced["events"]]
    assert events.count("brief_updated") == 7


def test_editing_an_inquiry_checks_the_result_as_a_whole(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"], date_from="2027-06-01", date_to="2027-06-10", budget_min=1000, budget_max=2000)
    url = f"{API}/inquiries/{inquiry['id']}"
    assert planner_client.patch(url, json={"date_from": "2027-06-20"}, headers=alice).status_code == 422
    assert planner_client.patch(url, json={"budget_max": 500}, headers=alice).status_code == 422
    assert planner_client.patch(url, json={"travelers": 1, "brief": {"children": 1}}, headers=alice).status_code == 422
    assert planner_client.patch(url, json={"destination": None}, headers=alice).status_code == 422

    ok = planner_client.patch(url, json={"destination": "Skardu", "date_to": None, "budget_min": None, "notes": "Updated"}, headers=alice).json()
    assert (ok["destination"], ok["date_to"], ok["budget_min"], ok["notes"]) == ("Skardu", None, None, "Updated")
    assert "destination" in ok["events"][0]["summary"]
    # Saving identical values records nothing.
    again = planner_client.patch(url, json={"destination": "Skardu"}, headers=alice).json()
    assert len(again["events"]) == len(ok["events"])


def test_list_filters_search_and_sorting(planner_client, alice):
    amina = make_customer(planner_client, alice, "Amina Rahman")
    bilal = make_customer(planner_client, alice, "Bilal Khan")
    a = make_inquiry(planner_client, alice, amina["id"], destination="Hunza Valley", budget_max=4000)
    make_inquiry(planner_client, alice, bilal["id"], destination="Skardu", budget_max=9000)
    move(planner_client, alice, a["id"], "contacted")

    def dests(query):
        return [i["destination"] for i in planner_client.get(f"{API}/inquiries?{query}", headers=alice).json()["items"]]

    assert sorted(dests("")) == ["Hunza Valley", "Skardu"]
    assert dests("stage=contacted") == ["Hunza Valley"]
    assert dests(f"customer_id={bilal['id']}") == ["Skardu"]
    assert dests("q=bilal") == ["Skardu"]  # by customer name
    assert dests("q=hunza") == ["Hunza Valley"]
    assert dests("sort=destination_asc") == ["Hunza Valley", "Skardu"]
    assert dests("sort=budget_desc") == ["Skardu", "Hunza Valley"]
    assert planner_client.get(f"{API}/inquiries?stage=bogus", headers=alice).status_code == 422
    # The list is for the pipeline: it names the customer but carries no contact details.
    row = planner_client.get(f"{API}/inquiries", headers=alice).json()["items"][0]
    assert set(row["customer"]) == {"id", "name"}


def test_deleting_an_inquiry_keeps_the_customers_history(planner_client, alice):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"], follow_up_on="2027-03-15")
    assert planner_client.delete(f"{API}/inquiries/{inquiry['id']}", headers=alice).status_code == 204
    assert planner_client.get(f"{API}/inquiries/{inquiry['id']}", headers=alice).status_code == 404
    assert planner_client.get(f"{API}/follow-ups?view=all", headers=alice).json()["total"] == 0
    summaries = [e["summary"] for e in planner_client.get(f"{API}/customers/{customer['id']}/events", headers=alice).json()["items"]]
    assert any("Started an inquiry" in s for s in summaries) and any("Deleted the inquiry" in s for s in summaries)


def test_another_owner_cannot_touch_an_inquiry(planner_client, alice, bob):
    customer = make_customer(planner_client, alice)
    inquiry = make_inquiry(planner_client, alice, customer["id"])
    confirm(planner_client, alice, inquiry["id"])
    url = f"{API}/inquiries/{inquiry['id']}"

    assert planner_client.get(f"{API}/inquiries", headers=bob).json()["total"] == 0
    assert planner_client.get(f"{API}/inquiries?q=hunza", headers=bob).json()["total"] == 0
    assert planner_client.get(url, headers=bob).status_code == 404
    assert planner_client.patch(url, json={"destination": "Hacked"}, headers=bob).status_code == 404
    assert move(planner_client, bob, inquiry["id"], "closed_lost").status_code == 404
    assert planner_client.post(f"{url}/convert", json=conversion_body(), headers=bob).status_code == 404
    assert planner_client.delete(url, headers=bob).status_code == 404

    untouched = planner_client.get(url, headers=alice).json()
    assert untouched["destination"] == "Hunza Valley" and untouched["stage"] == "confirmed"
    assert planner_client.get(f"{API}/trips", headers=bob).json() == []
