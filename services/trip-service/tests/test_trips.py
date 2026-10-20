import pytest
from datetime import date
from decimal import Decimal
from uuid import UUID
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.auth import get_current_user_id
from app.core.database import Base, get_db
from app.models.trip import Trip

# Connect to the running PostgreSQL test database to match the PostgreSQL UUID dialect accurately
SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/tripmind_trips"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

TEST_USER_ID = UUID("12345678-1234-5678-1234-567812345678")
OTHER_USER_ID = UUID("87654321-4321-8765-4321-876543218765")


@pytest.fixture(scope="function")
def db_session():
    """Provides a transactional database session per test with clean isolation."""
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient wired to the test db_session and authenticated TEST_USER_ID."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    def override_get_current_user_id():
        return TEST_USER_ID

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = override_get_current_user_id
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


@pytest.fixture(scope="function")
def unauth_client(db_session):
    """FastAPI TestClient with NO authentication override to test 401s."""
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
def sample_trip(db_session):
    """Pytest fixture: Creates a temporary sample trip owned by TEST_USER_ID."""
    trip = Trip(
        user_id=TEST_USER_ID,
        title="Patagonia Hiking",
        destination="El Chalten, Argentina",
        start_date=date(2027, 1, 5),
        end_date=date(2027, 1, 18),
        budget=Decimal("4100.00"),
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    yield trip

    existing = db_session.query(Trip).filter(Trip.id == trip.id).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()


@pytest.fixture(scope="function")
def multiple_trips(db_session):
    """Pytest fixture: Seeds trips owned by TEST_USER_ID and OTHER_USER_ID."""
    trips_data = [
        Trip(
            user_id=TEST_USER_ID,
            title="Iceland Aurora Hunt",
            destination="Reykjavik, Iceland",
            start_date=date(2026, 11, 10),
            end_date=date(2026, 11, 18),
            budget=Decimal("3800.00"),
        ),
        Trip(
            user_id=TEST_USER_ID,
            title="Moroccan Desert Trek",
            destination="Marrakech, Morocco",
            start_date=date(2027, 3, 1),
            end_date=date(2027, 3, 10),
            budget=Decimal("2900.00"),
        ),
        Trip(
            user_id=OTHER_USER_ID,
            title="Other User Secret Trip",
            destination="Secret City",
            start_date=date(2027, 5, 1),
            end_date=date(2027, 5, 5),
            budget=Decimal("1500.00"),
        ),
    ]
    for trip in trips_data:
        db_session.add(trip)
    db_session.commit()

    yield trips_data

    for trip in trips_data:
        existing = db_session.query(Trip).filter(Trip.id == trip.id).first()
        if existing:
            db_session.delete(existing)
    db_session.commit()


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "Trip Service"}


def test_unauthenticated_requests_fail(unauth_client):
    """Step 8.4: Verifies requests without a valid JWT are rejected with 401."""
    res = unauth_client.get("/api/v1/trips")
    assert res.status_code == 401


def test_get_sample_trip_via_fixture(client, sample_trip):
    res = client.get(f"/api/v1/trips/{sample_trip.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(sample_trip.id)
    assert data["title"] == "Patagonia Hiking"
    assert data["user_id"] == str(TEST_USER_ID)


def test_resource_level_authorization(client, multiple_trips):
    """Step 8.5: Verifies users only see their own trips and other users' trips are hidden."""
    res = client.get("/api/v1/trips")
    assert res.status_code == 200
    trips = res.json()
    titles = [t["title"] for t in trips]
    assert "Iceland Aurora Hunt" in titles
    assert "Moroccan Desert Trek" in titles
    assert "Other User Secret Trip" not in titles


def test_create_and_get_trip(client, db_session):
    payload = {
        "title": "Kyoto Autumn Special",
        "destination": "Kyoto, Japan",
        "start_date": "2026-11-01",
        "end_date": "2026-11-10",
        "budget": 3200.0,
    }
    create_res = client.post("/api/v1/trips", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["title"] == payload["title"]
    assert created["user_id"] == str(TEST_USER_ID)

    trip_id = created["id"]
    get_res = client.get(f"/api/v1/trips/{trip_id}")
    assert get_res.status_code == 200
    assert get_res.json()["destination"] == "Kyoto, Japan"

    # Cleanup created trip
    client.delete(f"/api/v1/trips/{trip_id}")


def test_update_trip_using_fixture(client, sample_trip):
    patch_res = client.patch(f"/api/v1/trips/{sample_trip.id}", json={"budget": 5200.0})
    assert patch_res.status_code == 200
    assert patch_res.json()["budget"] == 5200.0


def test_delete_trip_using_fixture(client, sample_trip):
    del_res = client.delete(f"/api/v1/trips/{sample_trip.id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/api/v1/trips/{sample_trip.id}")
    assert get_res.status_code == 404


def test_validation_errors(client):
    invalid_dates = {
        "title": "Invalid Trip",
        "destination": "Nowhere",
        "start_date": "2026-10-10",
        "end_date": "2026-10-01",
        "budget": 500.0,
    }
    res = client.post("/api/v1/trips", json=invalid_dates)
    assert res.status_code == 422

    invalid_budget = {
        "title": "Invalid Budget",
        "destination": "Nowhere",
        "start_date": "2026-10-01",
        "end_date": "2026-10-10",
        "budget": -100.0,
    }
    res = client.post("/api/v1/trips", json=invalid_budget)
    assert res.status_code == 422
