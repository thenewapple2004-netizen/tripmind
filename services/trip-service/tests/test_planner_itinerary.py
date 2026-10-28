from datetime import date, time, timedelta
from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.services.itinerary_service import DEFAULT_DURATION_MINUTES, find_conflicts

D1 = date(2027, 5, 10)


def day(trip, n):
    return (trip.start_date + timedelta(days=n)).isoformat()


def add(client, trip, headers, title="Activity", n=0, **extra):
    body = {"title": title, "activity_date": day(trip, n), **extra}
    res = client.post(f"/api/v1/trips/{trip.id}/activities", json=body, headers=headers)
    assert res.status_code == 201, res.text
    return res.json()


def itinerary(client, trip, headers):
    res = client.get(f"/api/v1/trips/{trip.id}/itinerary", headers=headers)
    assert res.status_code == 200, res.text
    return res.json()


def arrange(client, trip, headers, moves):
    return client.put(f"/api/v1/trips/{trip.id}/activities/arrange", json={"moves": moves}, headers=headers)


# ── Times and durations ──────────────────────────────────────────────────


def test_activity_stores_start_time_and_duration(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice, "Baltit Fort", start_time="09:30", duration_minutes=90)
    assert a["start_time"] == "09:30:00"
    assert a["duration_minutes"] == 90
    assert a["position"] == 0


def test_time_and_duration_are_optional(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice, "Free wander")
    assert a["start_time"] is None and a["duration_minutes"] is None


def test_seconds_are_dropped_from_start_time(planner_client, alice_trip, alice):
    assert add(planner_client, alice_trip, alice, start_time="10:15:45")["start_time"] == "10:15:00"


@pytest.mark.parametrize(
    "extra",
    [
        {"duration_minutes": 4},
        {"duration_minutes": 1441},
        {"duration_minutes": 0},
        {"start_time": "25:00"},
        {"start_time": "23:00", "duration_minutes": 90},  # runs past midnight
        {"start_time": "00:00", "duration_minutes": 1441},
    ],
)
def test_invalid_time_or_duration_is_rejected(planner_client, alice_trip, alice, extra):
    res = planner_client.post(
        f"/api/v1/trips/{alice_trip.id}/activities",
        json={"title": "x", "activity_date": day(alice_trip, 0), **extra},
        headers=alice,
    )
    assert res.status_code == 422


def test_an_activity_can_end_exactly_at_midnight(planner_client, alice_trip, alice):
    assert add(planner_client, alice_trip, alice, start_time="22:00", duration_minutes=120)["duration_minutes"] == 120


def test_partial_update_cannot_push_an_existing_activity_past_midnight(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice, start_time="22:00", duration_minutes=60)
    res = planner_client.patch(
        f"/api/v1/trips/{alice_trip.id}/activities/{a['id']}", json={"duration_minutes": 180}, headers=alice
    )
    assert res.status_code == 422
    res = planner_client.patch(
        f"/api/v1/trips/{alice_trip.id}/activities/{a['id']}", json={"start_time": "21:00"}, headers=alice
    )
    assert res.status_code == 200 and res.json()["start_time"] == "21:00:00"


def test_existing_activities_without_times_still_work(planner_client, alice_trip, alice):
    """Back-compat: the old payload (no time fields) is still valid."""
    res = planner_client.post(
        f"/api/v1/trips/{alice_trip.id}/activities",
        json={"title": "Old style", "activity_date": day(alice_trip, 1), "cost": 12.5},
        headers=alice,
    )
    assert res.status_code == 201 and res.json()["cost"] == 12.5


# ── Itinerary view ───────────────────────────────────────────────────────


def test_itinerary_lists_every_day_including_empty_ones(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "Day two thing", n=1, cost=10)
    data = itinerary(planner_client, alice_trip, alice)
    assert [d["day_number"] for d in data["days"]] == [1, 2, 3, 4, 5]
    assert [d["date"] for d in data["days"]] == [day(alice_trip, i) for i in range(5)]
    assert [len(d["activities"]) for d in data["days"]] == [0, 1, 0, 0, 0]
    assert data["total_activities"] == 1 and data["unscheduled_count"] == 1


def test_day_order_is_timed_by_time_then_untimed_by_position(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "untimed-first")
    add(planner_client, alice_trip, alice, "late", start_time="18:00", duration_minutes=30)
    add(planner_client, alice_trip, alice, "untimed-second")
    add(planner_client, alice_trip, alice, "early", start_time="08:00", duration_minutes=30)
    titles = [a["title"] for a in itinerary(planner_client, alice_trip, alice)["days"][0]["activities"]]
    assert titles == ["early", "late", "untimed-first", "untimed-second"]


def test_day_totals(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "a", cost=10, duration_minutes=60)
    add(planner_client, alice_trip, alice, "b", cost=5.5, duration_minutes=30)
    d = itinerary(planner_client, alice_trip, alice)["days"][0]
    assert d["total_cost"] == 15.5 and d["scheduled_minutes"] == 90


def test_changing_the_date_via_patch_puts_it_at_the_end_of_the_new_day(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "stay", n=1)
    mover = add(planner_client, alice_trip, alice, "mover", n=0)
    planner_client.patch(
        f"/api/v1/trips/{alice_trip.id}/activities/{mover['id']}", json={"activity_date": day(alice_trip, 1)}, headers=alice
    )
    titles = [a["title"] for a in itinerary(planner_client, alice_trip, alice)["days"][1]["activities"]]
    assert titles == ["stay", "mover"]


# ── Conflict detection ───────────────────────────────────────────────────


def test_overlapping_timed_activities_are_reported(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice, "Tour", start_time="09:00", duration_minutes=120)
    b = add(planner_client, alice_trip, alice, "Lunch", start_time="10:30", duration_minutes=60)
    conflicts = itinerary(planner_client, alice_trip, alice)["conflicts"]
    assert len(conflicts) == 1
    assert set(conflicts[0]["activity_ids"]) == {a["id"], b["id"]}
    assert conflicts[0]["overlap_minutes"] == 30
    assert conflicts[0]["activity_date"] == day(alice_trip, 0)


def test_back_to_back_activities_do_not_conflict(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "A", start_time="09:00", duration_minutes=60)
    add(planner_client, alice_trip, alice, "B", start_time="10:00", duration_minutes=60)
    assert itinerary(planner_client, alice_trip, alice)["conflicts"] == []


def test_same_times_on_different_days_do_not_conflict(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "A", n=0, start_time="09:00", duration_minutes=60)
    add(planner_client, alice_trip, alice, "B", n=1, start_time="09:00", duration_minutes=60)
    assert itinerary(planner_client, alice_trip, alice)["conflicts"] == []


def test_untimed_activities_never_conflict(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "A", duration_minutes=60)
    add(planner_client, alice_trip, alice, "B", start_time="09:00", duration_minutes=60)
    assert itinerary(planner_client, alice_trip, alice)["conflicts"] == []


def _a(start, duration=None, day_=D1):
    h, m = map(int, start.split(":"))
    return SimpleNamespace(id=uuid4(), activity_date=day_, start_time=time(h, m), duration_minutes=duration)


def test_missing_duration_assumes_the_default_for_conflicts():
    first = _a("09:00")  # no duration -> assumed 60 minutes, i.e. until 10:00
    inside = _a("09:59", 1)  # 09:59-10:00 overlaps it
    outside = _a("10:00", 15)  # starts exactly when `first` ends, and when `inside` ends: no overlap
    found = find_conflicts([first, inside, outside])
    assert DEFAULT_DURATION_MINUTES == 60
    assert [set(map(str, c.activity_ids)) for c in found] == [{str(first.id), str(inside.id)}]


def test_three_way_overlap_reports_each_overlapping_pair():
    a, b, c = _a("09:00", 180), _a("10:00", 60), _a("10:30", 60)
    pairs = {frozenset(map(str, c_.activity_ids)) for c_ in find_conflicts([a, b, c])}
    assert pairs == {
        frozenset({str(a.id), str(b.id)}),
        frozenset({str(a.id), str(c.id)}),
        frozenset({str(b.id), str(c.id)}),
    }


def test_a_contained_activity_overlaps_for_its_full_length():
    outer, inner = _a("09:00", 240), _a("10:00", 30)
    (conflict,) = find_conflicts([outer, inner])
    assert conflict.overlap_minutes == 30


def test_conflict_disappears_after_the_time_is_fixed(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "A", start_time="09:00", duration_minutes=120)
    b = add(planner_client, alice_trip, alice, "B", start_time="10:00", duration_minutes=60)
    assert len(itinerary(planner_client, alice_trip, alice)["conflicts"]) == 1
    planner_client.patch(f"/api/v1/trips/{alice_trip.id}/activities/{b['id']}", json={"start_time": "11:00"}, headers=alice)
    assert itinerary(planner_client, alice_trip, alice)["conflicts"] == []


# ── Drag and drop: arrange ───────────────────────────────────────────────


def test_move_an_activity_to_another_day(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice, "A", n=0)
    res = arrange(planner_client, alice_trip, alice, [{"id": a["id"], "activity_date": day(alice_trip, 2), "position": 0}])
    assert res.status_code == 200
    days = res.json()["days"]
    assert len(days[0]["activities"]) == 0 and [x["title"] for x in days[2]["activities"]] == ["A"]


def test_reorder_untimed_activities_within_a_day(planner_client, alice_trip, alice):
    a, b, c = (add(planner_client, alice_trip, alice, t) for t in "ABC")
    res = arrange(
        planner_client,
        alice_trip,
        alice,
        [{"id": c["id"], "activity_date": day(alice_trip, 0), "position": 0},
         {"id": a["id"], "activity_date": day(alice_trip, 0), "position": 1},
         {"id": b["id"], "activity_date": day(alice_trip, 0), "position": 2}],
    )
    assert [x["title"] for x in res.json()["days"][0]["activities"]] == ["C", "A", "B"]
    assert [x["position"] for x in res.json()["days"][0]["activities"]] == [0, 1, 2]


def test_positions_are_renumbered_even_if_the_client_sends_gaps(planner_client, alice_trip, alice):
    a, b = add(planner_client, alice_trip, alice, "A"), add(planner_client, alice_trip, alice, "B")
    res = arrange(
        planner_client, alice_trip, alice,
        [{"id": a["id"], "activity_date": day(alice_trip, 0), "position": 500},
         {"id": b["id"], "activity_date": day(alice_trip, 0), "position": 7}],
    )
    assert [(x["title"], x["position"]) for x in res.json()["days"][0]["activities"]] == [("B", 0), ("A", 1)]


def test_moving_a_timed_activity_keeps_its_time(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice, "Timed", start_time="14:00", duration_minutes=60)
    res = arrange(planner_client, alice_trip, alice, [{"id": a["id"], "activity_date": day(alice_trip, 3), "position": 0}])
    moved = res.json()["days"][3]["activities"][0]
    assert moved["start_time"] == "14:00:00" and moved["duration_minutes"] == 60


def test_moving_creates_and_resolves_conflicts(planner_client, alice_trip, alice):
    add(planner_client, alice_trip, alice, "Fixed", n=1, start_time="09:00", duration_minutes=60)
    mover = add(planner_client, alice_trip, alice, "Mover", n=0, start_time="09:30", duration_minutes=60)
    res = arrange(planner_client, alice_trip, alice, [{"id": mover["id"], "activity_date": day(alice_trip, 1), "position": 0}])
    assert len(res.json()["conflicts"]) == 1
    res = arrange(planner_client, alice_trip, alice, [{"id": mover["id"], "activity_date": day(alice_trip, 0), "position": 0}])
    assert res.json()["conflicts"] == []


def test_arrange_is_atomic_when_one_move_is_invalid(planner_client, alice_trip, alice):
    a, b = add(planner_client, alice_trip, alice, "A", n=0), add(planner_client, alice_trip, alice, "B", n=1)
    res = arrange(
        planner_client, alice_trip, alice,
        [{"id": a["id"], "activity_date": day(alice_trip, 4), "position": 0},
         {"id": b["id"], "activity_date": (alice_trip.end_date + timedelta(days=1)).isoformat(), "position": 0}],
    )
    assert res.status_code == 400
    days = itinerary(planner_client, alice_trip, alice)["days"]
    assert [len(d["activities"]) for d in days] == [1, 1, 0, 0, 0]  # nothing moved


def test_arrange_rejects_dates_outside_the_trip(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice)
    before = (alice_trip.start_date - timedelta(days=1)).isoformat()
    assert arrange(planner_client, alice_trip, alice, [{"id": a["id"], "activity_date": before, "position": 0}]).status_code == 400


def test_arrange_rejects_unknown_and_duplicate_ids(planner_client, alice_trip, alice):
    a = add(planner_client, alice_trip, alice)
    move = {"activity_date": day(alice_trip, 0), "position": 0}
    assert arrange(planner_client, alice_trip, alice, [{"id": str(uuid4()), **move}]).status_code == 404
    assert arrange(planner_client, alice_trip, alice, [{"id": a["id"], **move}, {"id": a["id"], **move}]).status_code == 422
    assert arrange(planner_client, alice_trip, alice, []).status_code == 422


def test_cannot_move_another_trips_activity_through_your_own_trip(planner_client, make_trip, alice):
    mine, other = make_trip(title="Mine"), make_trip(title="Other")
    theirs = add(planner_client, other, alice, "Theirs")
    res = arrange(planner_client, mine, alice, [{"id": theirs["id"], "activity_date": day(mine, 0), "position": 0}])
    assert res.status_code == 404
    assert [len(d["activities"]) for d in itinerary(planner_client, other, alice)["days"]][0] == 1


# ── Authorisation ────────────────────────────────────────────────────────


def test_itinerary_and_arrange_require_authentication(planner_client, alice_trip):
    assert planner_client.get(f"/api/v1/trips/{alice_trip.id}/itinerary").status_code == 401
    assert planner_client.put(f"/api/v1/trips/{alice_trip.id}/activities/arrange", json={"moves": []}).status_code == 401


def test_other_users_cannot_read_or_change_my_itinerary(planner_client, alice_trip, alice, bob):
    a = add(planner_client, alice_trip, alice, "Mine")
    assert planner_client.get(f"/api/v1/trips/{alice_trip.id}/itinerary", headers=bob).status_code == 404
    res = arrange(planner_client, alice_trip, bob, [{"id": a["id"], "activity_date": day(alice_trip, 1), "position": 0}])
    assert res.status_code == 404
    assert itinerary(planner_client, alice_trip, alice)["days"][0]["activities"][0]["title"] == "Mine"
