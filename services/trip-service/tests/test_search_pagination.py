import pytest
from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.trip import Trip

SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/tripmind_trips"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

USER_CHARLIE = UUID("cccccccc-cccc-cccc-cccc-cccccccccccc")
USER_DAVE = UUID("dddddddd-dddd-dddd-dddd-dddddddddddd")


@pytest.fixture(scope="function")
def db_session():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client(db_session):
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def seed_trips(db_session):
    today = date.today()
    # Create 7 trips for Charlie across different dates, budgets, and statuses
    charlie_trips = [
        Trip(
            user_id=USER_CHARLIE,
            title="Tokyo Anime & Tech",
            destination="Tokyo, Japan",
            start_date=today + timedelta(days=10),
            end_date=today + timedelta(days=20),
            budget=Decimal("3500.00"),
        ),
        Trip(
            user_id=USER_CHARLIE,
            title="Kyoto Zen Gardens",
            destination="Kyoto, Japan",
            start_date=today + timedelta(days=30),
            end_date=today + timedelta(days=40),
            budget=Decimal("2200.00"),
        ),
        Trip(
            user_id=USER_CHARLIE,
            title="Rome Historic Walk",
            destination="Rome, Italy",
            start_date=today - timedelta(days=2),
            end_date=today + timedelta(days=5),
            budget=Decimal("1800.00"),
        ),
        Trip(
            user_id=USER_CHARLIE,
            title="Paris Museums Tour",
            destination="Paris, France",
            start_date=today - timedelta(days=30),
            end_date=today - timedelta(days=20),
            budget=Decimal("2900.00"),
        ),
        Trip(
            user_id=USER_CHARLIE,
            title="Berlin Art & Music",
            destination="Berlin, Germany",
            start_date=today + timedelta(days=60),
            end_date=today + timedelta(days=70),
            budget=Decimal("1500.00"),
        ),
        Trip(
            user_id=USER_CHARLIE,
            title="London Theatre Week",
            destination="London, UK",
            start_date=today + timedelta(days=80),
            end_date=today + timedelta(days=90),
            budget=Decimal("4200.00"),
        ),
        Trip(
            user_id=USER_CHARLIE,
            title="Barcelona Beach & Tapas",
            destination="Barcelona, Spain",
            start_date=today + timedelta(days=100),
            end_date=today + timedelta(days=110),
            budget=Decimal("2500.00"),
        ),
    ]

    # Create 2 trips for Dave
    dave_trips = [
        Trip(
            user_id=USER_DAVE,
            title="Tokyo Food Adventure",
            destination="Tokyo, Japan",
            start_date=today + timedelta(days=5),
            end_date=today + timedelta(days=12),
            budget=Decimal("3000.00"),
        ),
    ]

    for t in charlie_trips + dave_trips:
        db_session.add(t)
    db_session.commit()

    yield charlie_trips

    for t in charlie_trips + dave_trips:
        existing = db_session.query(Trip).filter(Trip.id == t.id).first()
        if existing:
            db_session.delete(existing)
    db_session.commit()


def test_server_side_search_ilike(client, seed_trips):
    """Step 11.1: Verify search across title and destination with case-insensitive ILIKE."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_CHARLIE

    # Search for "japan" (matches destination "Tokyo, Japan" and "Kyoto, Japan")
    res = client.get("/api/v1/trips?search=japan")
    assert res.status_code == 200
    trips = res.json()
    assert len(trips) == 2
    titles = [t["title"] for t in trips]
    assert "Tokyo Anime & Tech" in titles
    assert "Kyoto Zen Gardens" in titles

    # Search for "walk" (matches title "Rome Historic Walk")
    res = client.get("/api/v1/trips?search=WALK")
    assert res.status_code == 200
    trips = res.json()
    assert len(trips) == 1
    assert trips[0]["title"] == "Rome Historic Walk"


def test_status_filters(client, seed_trips):
    """Step 11.2: Dynamic status filters: upcoming, ongoing, completed."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_CHARLIE

    # Ongoing: Rome Historic Walk (-2 days to +5 days)
    res_ongoing = client.get("/api/v1/trips?status=ongoing")
    assert res_ongoing.status_code == 200
    ongoing_trips = res_ongoing.json()
    assert len(ongoing_trips) == 1
    assert ongoing_trips[0]["title"] == "Rome Historic Walk"

    # Completed: Paris Museums Tour (-30 to -20 days)
    res_completed = client.get("/api/v1/trips?status=completed")
    assert res_completed.status_code == 200
    completed_trips = res_completed.json()
    assert len(completed_trips) == 1
    assert completed_trips[0]["title"] == "Paris Museums Tour"

    # Upcoming: remaining 5 trips
    res_upcoming = client.get("/api/v1/trips?status=upcoming")
    assert res_upcoming.status_code == 200
    upcoming_trips = res_upcoming.json()
    assert len(upcoming_trips) == 5


def test_budget_range_filter(client, seed_trips):
    """Step 11.2: Dynamic budget filtering."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_CHARLIE

    # Budget >= 3000
    res = client.get("/api/v1/trips?min_budget=3000")
    assert res.status_code == 200
    trips = res.json()
    assert len(trips) == 2
    for t in trips:
        assert t["budget"] >= 3000.0


def test_pagination_and_total_count(client, seed_trips):
    """Step 11.3: Pagination: page, page_size, total, total_pages, LIMIT, OFFSET."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_CHARLIE

    # Page 1 of size 3 (Total = 7 items -> 3 pages)
    res_p1 = client.get("/api/v1/trips?page=1&page_size=3")
    assert res_p1.status_code == 200
    data_p1 = res_p1.json()
    assert data_p1["total"] == 7
    assert data_p1["page"] == 1
    assert data_p1["page_size"] == 3
    assert data_p1["total_pages"] == 3
    assert len(data_p1["items"]) == 3

    # Page 2 of size 3
    res_p2 = client.get("/api/v1/trips?page=2&page_size=3")
    assert res_p2.status_code == 200
    data_p2 = res_p2.json()
    assert len(data_p2["items"]) == 3
    assert data_p2["page"] == 2

    # Verify no overlapping items between Page 1 and Page 2
    p1_ids = {t["id"] for t in data_p1["items"]}
    p2_ids = {t["id"] for t in data_p2["items"]}
    assert len(p1_ids.intersection(p2_ids)) == 0

    # Page 3 of size 3 (last page with 1 remaining item)
    res_p3 = client.get("/api/v1/trips?page=3&page_size=3")
    assert res_p3.status_code == 200
    data_p3 = res_p3.json()
    assert len(data_p3["items"]) == 1

    # Page 4 (out of range boundary condition)
    res_p4 = client.get("/api/v1/trips?page=4&page_size=3")
    assert res_p4.status_code == 200
    data_p4 = res_p4.json()
    assert len(data_p4["items"]) == 0
    assert data_p4["total"] == 7


def test_sorting_and_stable_ordering(client, seed_trips):
    """Step 11.4: Sorting: budget-desc, budget-asc, title, with stable secondary sort."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_CHARLIE

    # Sort by budget descending
    res_budget_desc = client.get("/api/v1/trips?sort_by=budget-desc")
    assert res_budget_desc.status_code == 200
    trips = res_budget_desc.json()
    budgets = [t["budget"] for t in trips]
    assert budgets == sorted(budgets, reverse=True)
    assert trips[0]["title"] == "London Theatre Week"  # 4200.00

    # Sort by title ascending
    res_title_asc = client.get("/api/v1/trips?sort_by=title-asc")
    assert res_title_asc.status_code == 200
    trips = res_title_asc.json()
    titles = [t["title"] for t in trips]
    assert titles == sorted(titles)
    assert trips[0]["title"] == "Barcelona Beach & Tapas"


def test_ownership_enforcement_in_search_and_pagination(client, seed_trips):
    """Step 11.8: User D cannot see User C's trips, even with matching search query."""
    # Dave searches for "Tokyo"
    app.dependency_overrides[get_current_user_id] = lambda: USER_DAVE

    res = client.get("/api/v1/trips?search=Tokyo&page=1&page_size=10")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["title"] == "Tokyo Food Adventure"
    # Charlie's "Tokyo Anime & Tech" must NOT appear
    assert not any(t["title"] == "Tokyo Anime & Tech" for t in data["items"])
