import pytest
from datetime import date
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.main import app
from app.core.database import Base, get_db

# Use in-memory SQLite for fast, isolated, reliable test runs
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


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


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy", "service": "Trip Service"}


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

    all_res = client.get("/api/v1/trips")
    assert all_res.status_code == 200
    assert len(all_res.json()) == 1


def test_update_trip(client):
    payload = {
        "title": "Swiss Alps",
        "destination": "Zermatt, Switzerland",
        "start_date": "2026-12-15",
        "end_date": "2026-12-24",
        "budget": 4500.0,
    }
    create_res = client.post("/api/v1/trips", json=payload)
    trip_id = create_res.json()["id"]

    patch_res = client.patch(f"/api/v1/trips/{trip_id}", json={"budget": 5200.0})
    assert patch_res.status_code == 200
    assert patch_res.json()["budget"] == 5200.0


def test_delete_trip(client):
    payload = {
        "title": "Road to Rome",
        "destination": "Rome, Italy",
        "start_date": "2026-09-01",
        "end_date": "2026-09-07",
        "budget": 1800.0,
    }
    create_res = client.post("/api/v1/trips", json=payload)
    trip_id = create_res.json()["id"]

    del_res = client.delete(f"/api/v1/trips/{trip_id}")
    assert del_res.status_code == 204

    get_res = client.get(f"/api/v1/trips/{trip_id}")
    assert get_res.status_code == 404


def test_validation_errors(client):
    # End date before start date
    invalid_dates = {
        "title": "Invalid Trip",
        "destination": "Nowhere",
        "start_date": "2026-10-10",
        "end_date": "2026-10-01",
        "budget": 500.0,
    }
    res = client.post("/api/v1/trips", json=invalid_dates)
    assert res.status_code == 422

    # Negative budget
    invalid_budget = {
        "title": "Invalid Budget",
        "destination": "Nowhere",
        "start_date": "2026-10-01",
        "end_date": "2026-10-10",
        "budget": -100.0,
    }
    res = client.post("/api/v1/trips", json=invalid_budget)
    assert res.status_code == 422
