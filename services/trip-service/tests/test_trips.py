import pytest
from datetime import date
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db
from app.models.trip import Trip

# Isolated in-memory SQLite for testing
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Provides a clean transactional database session per test, dropping tables after."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI TestClient wired to the test db_session."""
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
    """Pytest fixture: Creates a temporary sample trip and cleans it up after the test."""
    trip = Trip(
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

    # Teardown / cleanup
    existing = db_session.query(Trip).filter(Trip.id == trip.id).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()


@pytest.fixture(scope="function")
def multiple_trips(db_session):
    """Pytest fixture: Seeds multiple temporary trips for list testing and cleans them up."""
    trips_data = [
        Trip(
            title="Iceland Aurora Hunt",
            destination="Reykjavik, Iceland",
            start_date=date(2026, 11, 10),
            end_date=date(2026, 11, 18),
            budget=Decimal("3800.00"),
        ),
        Trip(
            title="Moroccan Desert Trek",
            destination="Marrakech, Morocco",
            start_date=date(2027, 3, 1),
            end_date=date(2027, 3, 10),
            budget=Decimal("2900.00"),
        ),
    ]
    for trip in trips_data:
        db_session.add(trip)
    db_session.commit()

    yield trips_data

    # Teardown / cleanup
    for trip in trips_data:
        existing = db_session.query(Trip).filter(Trip.id == trip.id).first()
        if existing:
            db_session.delete(existing)
    db_session.commit()


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "Trip Service"}


def test_get_sample_trip_via_fixture(client, sample_trip):
    """Verify that a trip pre-seeded by a pytest fixture is retrieved properly."""
    res = client.get(f"/api/v1/trips/{sample_trip.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(sample_trip.id)
    assert data["title"] == "Patagonia Hiking"
    assert data["destination"] == "El Chalten, Argentina"


def test_get_multiple_trips_via_fixture(client, multiple_trips):
    """Verify that multiple seeded fixture trips are returned in list endpoint."""
    res = client.get("/api/v1/trips")
    assert res.status_code == 200
    trips = res.json()
    assert len(trips) == 2
    titles = [t["title"] for t in trips]
    assert "Iceland Aurora Hunt" in titles
    assert "Moroccan Desert Trek" in titles


def test_create_and_get_trip(client):
    payload = {
        "title": "Kyoto Autumn",
        "destination": "Kyoto, Japan",
        "start_date": "2026-11-01",
        "end_date": "2026-11-10",
        "budget": 3200.0,
    }
    create_res = client.post("/api/v1/trips", json=payload)
    assert create_res.status_code == 201
    created = create_res.json()
    assert created["title"] == payload["title"]
    assert "id" in created

    trip_id = created["id"]
    get_res = client.get(f"/api/v1/trips/{trip_id}")
    assert get_res.status_code == 200
    assert get_res.json()["destination"] == "Kyoto, Japan"


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
