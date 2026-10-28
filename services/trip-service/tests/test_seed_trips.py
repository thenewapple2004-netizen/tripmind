"""Guards the development seed data so it always stays loadable and varied."""

from collections import Counter

from app.seeds.trips_data import TRIPS

CATEGORIES = {"Food", "Transportation", "Accommodation", "Activities", "Shopping", "Other"}
NORTHERN_MARKERS = ("Gilgit-Baltistan", "Khyber Pakhtunkhwa", "Azad Kashmir", "Chitral", "Karakoram", "Swat", "Murree")


def test_there_are_more_than_twenty_trips_with_unique_keys():
    assert len(TRIPS) > 20
    keys = [t["key"] for t in TRIPS]
    assert len(set(keys)) == len(keys)


def test_northern_areas_are_well_represented():
    northern = [t for t in TRIPS if any(m in t["destination"] for m in NORTHERN_MARKERS)]
    assert len(northern) >= 10
    for place in ("Hunza", "Skardu", "Fairy Meadows", "Deosai", "Khunjerab", "K2"):
        assert any(place in t["destination"] or place in t["title"] for t in TRIPS), place


def test_trips_fit_the_database_columns():
    for t in TRIPS:
        assert 0 < len(t["title"]) <= 100, t["key"]
        assert 0 < len(t["destination"]) <= 100, t["key"]
        assert t["days"] >= 1 and t["budget"] > 0, t["key"]
        assert t["budget"] < 99_999_999, t["key"]


def test_activities_fall_inside_the_trip_and_fit_columns():
    for t in TRIPS:
        assert t["activities"], f"{t['key']} has no activities"
        for day, title, location, cost in t["activities"]:
            assert 0 <= day < t["days"], (t["key"], title)
            assert 0 < len(title) <= 150 and 0 < len(location) <= 150, (t["key"], title)
            assert cost >= 0, (t["key"], title)


def test_expenses_use_valid_categories_and_positive_amounts():
    for t in TRIPS:
        assert t["expenses"], f"{t['key']} has no expenses"
        for day, title, category, amount in t["expenses"]:
            assert category in CATEGORIES, (t["key"], title, category)
            assert amount > 0, (t["key"], title)
            assert day < t["days"], (t["key"], title)  # may be negative: a pre-paid booking
            assert len(title) <= 150, (t["key"], title)


def test_row_identities_are_unique_within_a_trip():
    # The seeder derives ids from (day, title); duplicates would collide.
    for t in TRIPS:
        acts = Counter((d, title) for d, title, *_ in t["activities"])
        exps = Counter((d, title) for d, title, *_ in t["expenses"])
        assert max(acts.values()) == 1, t["key"]
        assert max(exps.values()) == 1, t["key"]


def test_trips_span_past_present_and_future():
    def status(t):
        if t["start"] > 0:
            return "upcoming"
        return "completed" if t["start"] + t["days"] - 1 < 0 else "ongoing"

    seen = Counter(status(t) for t in TRIPS)
    assert seen["completed"] >= 5 and seen["ongoing"] >= 1 and seen["upcoming"] >= 5


def test_at_least_one_trip_is_over_budget_and_most_are_not():
    over = [t for t in TRIPS if sum(e[3] for e in t["expenses"]) > t["budget"]]
    assert 1 <= len(over) <= 3


def test_schedule_gives_most_activities_a_time_without_any_conflicts_except_the_planted_one():
    from datetime import time
    from types import SimpleNamespace
    from uuid import uuid4

    from app.seeds.trips_data import schedule_activities
    from app.services.itinerary_service import find_conflicts

    total = timed = 0
    conflicts = []
    for t in TRIPS:
        plan = schedule_activities(t)
        fake = []
        for day, title, *_ in t["activities"]:
            slot = plan[title]
            total += 1
            timed += slot["start_time"] is not None
            if slot["start_time"]:
                h, m = map(int, slot["start_time"].split(":"))
                assert h * 60 + m + slot["duration_minutes"] <= 24 * 60, (t["key"], title)
                fake.append(SimpleNamespace(id=uuid4(), activity_date=day, start_time=time(h, m), duration_minutes=slot["duration_minutes"]))
        conflicts += [(t["key"], c) for c in find_conflicts(fake)]
    assert timed / total > 0.6
    assert [key for key, _ in conflicts] == ["lahore-food-heritage"]
