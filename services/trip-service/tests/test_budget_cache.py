from datetime import date
from decimal import Decimal
from unittest.mock import patch
from uuid import UUID
import fnmatch
import pytest
import redis
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.auth import get_current_user_id
from app.core.config import settings
from app.core.database import get_db
from app.core import cache
from app.core.cache import get_budget_cache_key
from app.models.trip import Trip
from app.models.expense import Expense

SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/tripmind_trips"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

USER_ALICE = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_BOB = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


class InMemoryRedis:
    """Isolated, zero-network Redis simulation for automated unit testing."""
    def __init__(self):
        self._store = {}
        self._ttls = {}

    def get(self, key):
        return self._store.get(key)

    def set(self, key, value, ex=None):
        self._store[key] = str(value)
        if ex is not None:
            self._ttls[key] = ex
        return True

    def delete(self, *keys):
        count = 0
        for k in keys:
            if k in self._store:
                del self._store[k]
                self._ttls.pop(k, None)
                count += 1
        return count

    def scan_iter(self, match="*"):
        for k in list(self._store.keys()):
            if fnmatch.fnmatch(k, match):
                yield k

    def ping(self):
        return True


@pytest.fixture(autouse=True)
def mock_redis():
    fake_client = InMemoryRedis()
    with patch.object(cache, "redis_client", fake_client):
        yield fake_client


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
def alice_trip_with_expense(db_session):
    trip = Trip(
        user_id=USER_ALICE,
        title="Kyoto Exploration",
        destination="Kyoto, Japan",
        start_date=date(2027, 6, 1),
        end_date=date(2027, 6, 10),
        budget=Decimal("3000.00"),
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    expense = Expense(
        trip_id=trip.id,
        title="Ryokan Stay",
        amount=Decimal("450.00"),
        category="Accommodation",
        expense_date=date(2027, 6, 2),
    )
    db_session.add(expense)
    db_session.commit()
    db_session.refresh(expense)

    cache_key = get_budget_cache_key(USER_ALICE, trip.id)
    cache.delete_cache(cache_key)

    yield trip, expense

    cache.delete_cache(cache_key)
    existing_trip = db_session.query(Trip).filter(Trip.id == trip.id).first()
    if existing_trip:
        db_session.delete(existing_trip)
        db_session.commit()


def test_budget_summary_cache_miss_then_hit(client, alice_trip_with_expense, mock_redis):
    trip, _ = alice_trip_with_expense
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    cache_key = get_budget_cache_key(USER_ALICE, trip.id)

    # 1. Initial state: cache miss
    assert mock_redis.get(cache_key) is None

    # First request: Cache Miss -> calculates from PostgreSQL and stores in Redis
    res1 = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert res1.status_code == 200
    data1 = res1.json()
    assert Decimal(str(data1["total_spent"])) == Decimal("450.00")
    assert Decimal(str(data1["budget"])) == Decimal("3000.00")

    # Verify cache is populated in Redis with TTL
    cached_val = mock_redis.get(cache_key)
    assert cached_val is not None
    assert "450.00" in cached_val
    assert mock_redis._ttls.get(cache_key) == settings.redis_cache_ttl

    # Second request: Cache Hit
    # Patch expense repository aggregation to fail if called, proving response comes from Redis
    with patch("app.services.expense_service.expense_repository.get_total_spent", side_effect=AssertionError("Should not call DB on cache hit")):
        res2 = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
        assert res2.status_code == 200
        data2 = res2.json()
        assert data1 == data2


def test_cached_and_uncached_responses_contain_equivalent_data(client, alice_trip_with_expense, mock_redis):
    trip, _ = alice_trip_with_expense
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    cache_key = get_budget_cache_key(USER_ALICE, trip.id)

    # Empty cache for uncached calculation
    mock_redis.delete(cache_key)
    uncached_res = client.get(f"/api/v1/trips/{trip.id}/expenses/summary").json()

    # Cached hit
    cached_res = client.get(f"/api/v1/trips/{trip.id}/expenses/summary").json()

    # Verify exact equivalence across all fields and Decimal values
    assert uncached_res["budget"] == cached_res["budget"]
    assert uncached_res["total_spent"] == cached_res["total_spent"]
    assert uncached_res["remaining_budget"] == cached_res["remaining_budget"]
    assert uncached_res["percent_spent"] == cached_res["percent_spent"]
    assert uncached_res["is_over_budget"] == cached_res["is_over_budget"]
    assert uncached_res["expense_count"] == cached_res["expense_count"]
    assert uncached_res["by_category"] == cached_res["by_category"]


def test_cache_expires_after_ttl(client, alice_trip_with_expense, mock_redis):
    trip, _ = alice_trip_with_expense
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    cache_key = get_budget_cache_key(USER_ALICE, trip.id)

    # Populate cache
    client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert mock_redis.get(cache_key) is not None
    assert mock_redis._ttls.get(cache_key) == settings.redis_cache_ttl

    # Simulate TTL expiry
    mock_redis.delete(cache_key)
    assert mock_redis.get(cache_key) is None

    # Next request triggers fresh DB calculation and re-populates cache
    res = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert res.status_code == 200
    assert mock_redis.get(cache_key) is not None


def test_expense_creation_invalidates_cache(client, alice_trip_with_expense, mock_redis):
    trip, _ = alice_trip_with_expense
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    cache_key = get_budget_cache_key(USER_ALICE, trip.id)

    # Warm cache
    client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert mock_redis.get(cache_key) is not None

    # Create new expense
    new_expense = {
        "title": "Matcha Tea",
        "amount": "15.00",
        "category": "Food",
        "expense_date": "2027-06-03",
    }
    create_res = client.post(f"/api/v1/trips/{trip.id}/expenses", json=new_expense)
    assert create_res.status_code == 201

    # Invalidation verification: cache key was deleted
    assert mock_redis.get(cache_key) is None

    # Subsequent request reflects new calculation (450 + 15 = 465)
    summary_res = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert summary_res.status_code == 200
    assert Decimal(str(summary_res.json()["total_spent"])) == Decimal("465.00")
    assert summary_res.json()["expense_count"] == 2


def test_expense_update_and_deletion_invalidates_cache(client, alice_trip_with_expense, mock_redis):
    trip, expense = alice_trip_with_expense
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    cache_key = get_budget_cache_key(USER_ALICE, trip.id)

    # 1. Warm cache
    client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert mock_redis.get(cache_key) is not None

    # 2. Update expense amount: 450 -> 500
    update_res = client.patch(
        f"/api/v1/trips/{trip.id}/expenses/{expense.id}",
        json={"amount": "500.00"},
    )
    assert update_res.status_code == 200

    # Cache should be invalidated
    assert mock_redis.get(cache_key) is None

    # Summary should reflect 500.00
    res_after_update = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert Decimal(str(res_after_update.json()["total_spent"])) == Decimal("500.00")

    # 3. Warm cache again
    assert mock_redis.get(cache_key) is not None

    # 4. Delete expense
    delete_res = client.delete(f"/api/v1/trips/{trip.id}/expenses/{expense.id}")
    assert delete_res.status_code == 204

    # Cache should be invalidated
    assert mock_redis.get(cache_key) is None

    # Summary should reflect 0.00
    res_after_delete = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert Decimal(str(res_after_delete.json()["total_spent"])) == Decimal("0.00")
    assert res_after_delete.json()["expense_count"] == 0


def test_trip_budget_update_invalidates_cache(client, alice_trip_with_expense, mock_redis):
    trip, _ = alice_trip_with_expense
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    cache_key = get_budget_cache_key(USER_ALICE, trip.id)

    # Warm cache
    res1 = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert res1.status_code == 200
    assert Decimal(str(res1.json()["budget"])) == Decimal("3000.00")
    assert mock_redis.get(cache_key) is not None

    # Update trip budget: 3000 -> 4000
    patch_res = client.patch(f"/api/v1/trips/{trip.id}", json={"budget": 4000.00})
    assert patch_res.status_code == 200

    # Cache must be invalidated
    assert mock_redis.get(cache_key) is None

    # Summary must show new budget 4000.00
    res2 = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert res2.status_code == 200
    assert Decimal(str(res2.json()["budget"])) == Decimal("4000.00")
    assert Decimal(str(res2.json()["remaining_budget"])) == Decimal("3550.00")


def test_unauthorized_user_cannot_access_cached_data(client, alice_trip_with_expense, mock_redis):
    trip, _ = alice_trip_with_expense
    # Alice warms cache
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    res_alice = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
    assert res_alice.status_code == 200

    alice_cache_key = get_budget_cache_key(USER_ALICE, trip.id)
    assert mock_redis.get(alice_cache_key) is not None

    # Bob attempts to access Alice's trip summary
    app.dependency_overrides[get_current_user_id] = lambda: USER_BOB
    bob_res = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")

    # Bob must be rejected with 404 (ownership check)
    assert bob_res.status_code == 404

    # Alice's cache remains untouched and Bob never received it
    assert mock_redis.get(alice_cache_key) is not None
    bob_cache_key = get_budget_cache_key(USER_BOB, trip.id)
    assert mock_redis.get(bob_cache_key) is None


def test_redis_downtime_does_not_break_budget_summary(client, alice_trip_with_expense, mock_redis):
    trip, _ = alice_trip_with_expense
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE

    # Simulate complete Redis outage by raising ConnectionError on get and set
    with patch.object(mock_redis, "get", side_effect=redis.ConnectionError("Redis connection refused")), \
         patch.object(mock_redis, "set", side_effect=redis.ConnectionError("Redis connection refused")):
        # Request must succeed with 200 OK by gracefully falling back to PostgreSQL
        res = client.get(f"/api/v1/trips/{trip.id}/expenses/summary")
        assert res.status_code == 200
        data = res.json()
        assert Decimal(str(data["total_spent"])) == Decimal("450.00")
        assert Decimal(str(data["budget"])) == Decimal("3000.00")
