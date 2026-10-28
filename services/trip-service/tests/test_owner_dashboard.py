"""
test_owner_dashboard.py
=======================
Tests for Task 17 — TripMind Owner Dashboard & Portal Foundation:
- Aggregated metrics across trips, expenses, activities, and reports
- Multi-tenant data isolation (Owner A never sees Owner B's portfolio)
- PostgreSQL aggregations (budget, spending, category breakdown, trends)
- Redis cache-aside and invalidation on data changes
- Paginated activities and expenses across owner trips
"""

from datetime import date, timedelta
from decimal import Decimal
import os
from unittest.mock import patch
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core import cache
from app.core.auth import get_current_user_id
from app.core.config import settings
from app.core.database import get_db
from app.main import app
from app.models.activity import Activity
from app.models.expense import Expense
from app.models.schemas import ExpenseCreate, TripCreate
from app.models.trip import Trip
from app.services.activity_service import activity_service
from app.services.expense_service import expense_service
from app.services.trip_service import trip_repository

SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/tripmind_trips"
engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

USER_ALICE = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_BOB = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


class InMemoryRedis:
    def __init__(self):
        self._store = {}

    def get(self, key):
        return self._store.get(key)

    def set(self, key, value, ex=None):
        self._store[key] = str(value)
        return True

    def delete(self, *keys):
        count = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                count += 1
        return count

    def ping(self):
        return True


@pytest.fixture(autouse=True)
def mock_redis():
    fake_redis = InMemoryRedis()
    with patch("app.core.cache.redis_client", fake_redis):
        yield fake_redis


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
def alice_trips_and_expenses(db_session):
    today = date.today()

    # 1. Upcoming trip
    trip1 = Trip(
        user_id=USER_ALICE,
        title="Kyoto Cherry Blossoms",
        destination="Kyoto, Japan",
        start_date=today + timedelta(days=10),
        end_date=today + timedelta(days=20),
        budget=Decimal("5000.00"),
    )
    # 2. Ongoing trip
    trip2 = Trip(
        user_id=USER_ALICE,
        title="Santorini Sunset Getaway",
        destination="Santorini, Greece",
        start_date=today - timedelta(days=2),
        end_date=today + timedelta(days=5),
        budget=Decimal("3000.00"),
    )
    # 3. Completed trip
    trip3 = Trip(
        user_id=USER_ALICE,
        title="Alps Skiing",
        destination="Zermatt, Switzerland",
        start_date=today - timedelta(days=30),
        end_date=today - timedelta(days=25),
        budget=Decimal("2000.00"),
    )
    db_session.add_all([trip1, trip2, trip3])
    db_session.commit()
    db_session.refresh(trip1)
    db_session.refresh(trip2)
    db_session.refresh(trip3)

    # Activities for Alice
    act1 = Activity(
        trip_id=trip1.id,
        title="Tea Ceremony",
        location="Gion",
        activity_date=today + timedelta(days=12),
        cost=Decimal("75.00"),
        description="Traditional matcha experience",
    )
    act2 = Activity(
        trip_id=trip2.id,
        title="Catamaran Cruise",
        location="Oia",
        activity_date=today,
        cost=Decimal("150.00"),
        description="Sunset caldera tour",
    )
    db_session.add_all([act1, act2])

    # Expenses for Alice
    exp1 = Expense(
        trip_id=trip1.id,
        title="Ryokan Hotel Deposit",
        amount=Decimal("1200.00"),
        category="Accommodation",
        expense_date=today + timedelta(days=10),
        description="First night prepaid",
    )
    exp2 = Expense(
        trip_id=trip1.id,
        title="Bullet Train Tickets",
        amount=Decimal("350.00"),
        category="Transportation",
        expense_date=today + timedelta(days=11),
        description="Shinkansen Tokyo -> Kyoto",
    )
    exp3 = Expense(
        trip_id=trip2.id,
        title="Seafood Taverna Dinner",
        amount=Decimal("180.00"),
        category="Food",
        expense_date=today - timedelta(days=1),
        description="Fresh catch of the day",
    )
    db_session.add_all([exp1, exp2, exp3])
    db_session.commit()

    # Bob's data (must never leak to Alice)
    bob_trip = Trip(
        user_id=USER_BOB,
        title="Bob's Secret Trip",
        destination="Secret City",
        start_date=today + timedelta(days=5),
        end_date=today + timedelta(days=15),
        budget=Decimal("9999.00"),
    )
    db_session.add(bob_trip)
    db_session.commit()
    db_session.refresh(bob_trip)

    bob_exp = Expense(
        trip_id=bob_trip.id,
        title="Bob's Secret Expense",
        amount=Decimal("5000.00"),
        category="Other",
        expense_date=today + timedelta(days=6),
    )
    db_session.add(bob_exp)
    db_session.commit()

    # Clear Redis caches
    from app.core.cache import get_owner_dashboard_cache_key
    cache.delete_cache(get_owner_dashboard_cache_key(USER_ALICE))
    cache.delete_cache(get_owner_dashboard_cache_key(USER_BOB))

    yield {"alice_trips": [trip1, trip2, trip3], "bob_trip": bob_trip}

    # Cleanup
    db_session.query(Expense).filter(Expense.trip_id.in_([trip1.id, trip2.id, trip3.id, bob_trip.id])).delete(synchronize_session=False)
    db_session.query(Activity).filter(Activity.trip_id.in_([trip1.id, trip2.id, trip3.id, bob_trip.id])).delete(synchronize_session=False)
    db_session.query(Trip).filter(Trip.id.in_([trip1.id, trip2.id, trip3.id, bob_trip.id])).delete(synchronize_session=False)
    db_session.commit()


# ── Dashboard Metrics & Overview Tests ────────────────────────────────────────


def test_get_owner_dashboard_empty_user(client):
    """User with no trips gets an empty dashboard structure with zeros and empty lists."""
    empty_user = uuid4()
    app.dependency_overrides[get_current_user_id] = lambda: empty_user

    res = client.get("/api/v1/owner/dashboard")
    assert res.status_code == 200
    data = res.json()

    assert data["overview"]["total_trips"] == 0
    assert float(data["overview"]["total_budget"]) == 0.0
    assert float(data["overview"]["total_spent"]) == 0.0
    assert data["overview"]["budget_utilization_pct"] == 0.0
    assert data["overview"]["total_activities"] == 0
    assert data["overview"]["total_expenses_count"] == 0
    assert data["upcoming_trips"] == []
    assert data["category_expenses"] == []


def test_get_owner_dashboard_aggregated_metrics(client, alice_trips_and_expenses):
    """Verify accurate aggregation across trips, budgets, expenses, and categories for Alice."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE

    res = client.get("/api/v1/owner/dashboard")
    assert res.status_code == 200
    data = res.json()
    ov = data["overview"]

    # 1. Total trips & status breakdown
    assert ov["total_trips"] == 3
    assert ov["upcoming_trips_count"] == 1
    assert ov["ongoing_trips_count"] == 1
    assert ov["completed_trips_count"] == 1

    # 2. Total budget: 5000 + 3000 + 2000 = 10000.00
    assert float(ov["total_budget"]) == 10000.0

    # 3. Total spent: 1200 + 350 + 180 = 1730.00 (Bob's 5000 is excluded)
    assert float(ov["total_spent"]) == 1730.0
    assert float(ov["remaining_budget"]) == 8270.0
    assert ov["budget_utilization_pct"] == 17.3
    assert ov["is_over_budget"] is False
    assert ov["total_activities"] == 2
    assert ov["total_expenses_count"] == 3

    # 4. Category breakdown: Accommodation (1200), Transportation (350), Food (180)
    cats = {c["category"]: float(c["total_amount"]) for c in data["category_expenses"]}
    assert cats["Accommodation"] == 1200.0
    assert cats["Transportation"] == 350.0
    assert cats["Food"] == 180.0

    # 5. Upcoming / Active Trips list
    assert len(data["upcoming_trips"]) == 2  # trip1 (upcoming) and trip2 (ongoing)
    first_trip = data["upcoming_trips"][0]
    assert first_trip["title"] in ["Kyoto Cherry Blossoms", "Santorini Sunset Getaway"]

    # 6. Recent activities
    assert len(data["recent_activities"]) == 2

    # 7. Recent expenses
    assert len(data["recent_expenses"]) == 3


def test_owner_dashboard_multi_tenant_isolation(client, alice_trips_and_expenses):
    """Ensure Owner Bob only sees his own trip and spending; Bob cannot see Alice's data."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_BOB

    res = client.get("/api/v1/owner/dashboard")
    assert res.status_code == 200
    data = res.json()
    ov = data["overview"]

    assert ov["total_trips"] == 1
    assert float(ov["total_budget"]) == 9999.0
    assert float(ov["total_spent"]) == 5000.0
    assert ov["total_expenses_count"] == 1
    assert ov["total_activities"] == 0

    # Bob has only "Other" category
    cats = [c["category"] for c in data["category_expenses"]]
    assert cats == ["Other"]
    assert "Accommodation" not in cats
    assert "Transportation" not in cats


# ── Redis Cache-Aside & Invalidation Tests ───────────────────────────────────


def test_owner_dashboard_redis_cache_and_invalidation(client, alice_trips_and_expenses, db_session):
    """Verify dashboard is cached in Redis on first request, and invalidated on new expense."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    from app.core.cache import get_owner_dashboard_cache_key

    cache_key = get_owner_dashboard_cache_key(USER_ALICE)

    # 1. First request -> computes and stores in Redis
    res1 = client.get("/api/v1/owner/dashboard")
    assert res1.status_code == 200
    assert cache.get_cache(cache_key) is not None

    # 2. Add an expense -> triggers cache invalidation
    trip1 = alice_trips_and_expenses["alice_trips"][0]
    exp_in = ExpenseCreate(
        title="Souvenir Fan",
        amount=Decimal("50.00"),
        category="Shopping",
        expense_date=trip1.start_date,
        description="Crafted bamboo fan",
    )
    expense_service.create_expense(db_session, trip1.id, exp_in, user_id=USER_ALICE)

    # Cache key must now be cleared
    assert cache.get_cache(cache_key) is None

    # 3. Next request recomputes updated total spent (1730 + 50 = 1780)
    res2 = client.get("/api/v1/owner/dashboard")
    assert res2.status_code == 200
    assert float(res2.json()["overview"]["total_spent"]) == 1780.0


# ── Paginated Activities & Expenses Tests ────────────────────────────────────


def test_owner_paginated_activities(client, alice_trips_and_expenses):
    """Verify GET /api/v1/owner/activities returns paginated activities for the owner."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE

    res = client.get("/api/v1/owner/activities?page=1&page_size=1")
    assert res.status_code == 200
    data = res.json()

    assert data["total"] == 2
    assert len(data["items"]) == 1
    assert data["page"] == 1
    assert data["page_size"] == 1
    assert data["total_pages"] == 2


def test_owner_paginated_expenses_with_category_filter(client, alice_trips_and_expenses):
    """Verify GET /api/v1/owner/expenses filters by category and paginates."""
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE

    # Filter category=Accommodation
    res = client.get("/api/v1/owner/expenses?category=Accommodation")
    assert res.status_code == 200
    data = res.json()

    assert data["total"] == 1
    assert data["items"][0]["category"] == "Accommodation"
    assert float(data["items"][0]["amount"]) == 1200.0


def test_unauthenticated_owner_dashboard_returns_401(client):
    """Requests without authorization token must be rejected with 401."""
    # Ensure no dependency overrides
    app.dependency_overrides.clear()
    res = client.get("/api/v1/owner/dashboard")
    assert res.status_code in (401, 403)
