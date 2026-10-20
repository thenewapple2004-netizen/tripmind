import pytest
from datetime import date
from decimal import Decimal
from uuid import UUID
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.trip import Trip
from app.models.activity import Activity

SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/tripmind_trips"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

USER_ALICE = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_BOB = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


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
def alice_trip(db_session):
    trip = Trip(
        user_id=USER_ALICE,
        title="Tokyo Explorations",
        destination="Tokyo, Japan",
        start_date=date(2027, 4, 1),
        end_date=date(2027, 4, 15),
        budget=Decimal("4000.00"),
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    yield trip

    existing = db_session.query(Trip).filter(Trip.id == trip.id).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()


def test_create_activity_success(client, alice_trip):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    activity_data = {
        "title": "Visit Shibuya Sky",
        "description": "Sunset observation deck tickets",
        "location": "Shibuya, Tokyo",
        "activity_date": "2027-04-05",
        "cost": 35.50,
    }
    res = client.post(f"/api/v1/trips/{alice_trip.id}/activities", json=activity_data)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Visit Shibuya Sky"
    assert data["trip_id"] == str(alice_trip.id)
    assert data["cost"] == 35.50

    # Cleanup activity
    client.delete(f"/api/v1/trips/{alice_trip.id}/activities/{data['id']}")


def test_activity_date_validation_outside_trip_dates(client, alice_trip):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    # Trip dates: 2027-04-01 to 2027-04-15
    invalid_date = {
        "title": "Early Arrival",
        "activity_date": "2027-03-25",
        "cost": 10.0,
    }
    res = client.post(f"/api/v1/trips/{alice_trip.id}/activities", json=invalid_date)
    assert res.status_code == 400
    assert "must be between trip start date" in res.json()["detail"]


def test_activity_ownership_denies_bob(client, alice_trip):
    # Alice adds an activity
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    activity_data = {
        "title": "Teamlab Planets",
        "activity_date": "2027-04-08",
        "cost": 40.0,
    }
    create_res = client.post(f"/api/v1/trips/{alice_trip.id}/activities", json=activity_data)
    assert create_res.status_code == 201
    activity_id = create_res.json()["id"]

    # Switch authentication context to Bob
    app.dependency_overrides[get_current_user_id] = lambda: USER_BOB

    # Bob tries to view Alice's trip activities
    bob_list_res = client.get(f"/api/v1/trips/{alice_trip.id}/activities")
    assert bob_list_res.status_code == 404

    # Bob tries to access Alice's activity directly
    bob_get_res = client.get(f"/api/v1/trips/{alice_trip.id}/activities/{activity_id}")
    assert bob_get_res.status_code == 404

    # Bob tries to delete Alice's activity
    bob_del_res = client.delete(f"/api/v1/trips/{alice_trip.id}/activities/{activity_id}")
    assert bob_del_res.status_code == 404

    # Switch back to Alice to clean up
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    client.delete(f"/api/v1/trips/{alice_trip.id}/activities/{activity_id}")


def test_update_and_delete_activity(client, alice_trip):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    # Add activity
    activity_data = {
        "title": "Senso-ji Temple",
        "activity_date": "2027-04-03",
        "cost": 0.0,
    }
    create_res = client.post(f"/api/v1/trips/{alice_trip.id}/activities", json=activity_data)
    activity_id = create_res.json()["id"]

    # Update activity
    update_res = client.patch(
        f"/api/v1/trips/{alice_trip.id}/activities/{activity_id}",
        json={"cost": 15.0, "description": "Incense and omikuji"},
    )
    assert update_res.status_code == 200
    assert update_res.json()["cost"] == 15.0
    assert update_res.json()["description"] == "Incense and omikuji"

    # Delete activity
    del_res = client.delete(f"/api/v1/trips/{alice_trip.id}/activities/{activity_id}")
    assert del_res.status_code == 204

    # Confirm deletion
    get_res = client.get(f"/api/v1/trips/{alice_trip.id}/activities/{activity_id}")
    assert get_res.status_code == 404
