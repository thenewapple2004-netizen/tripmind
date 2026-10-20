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
from app.models.expense import Expense

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
        title="Paris Vacation",
        destination="Paris, France",
        start_date=date(2027, 5, 1),
        end_date=date(2027, 5, 10),
        budget=Decimal("2500.00"),
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    yield trip

    existing = db_session.query(Trip).filter(Trip.id == trip.id).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()


def test_create_expense_with_decimal_precision(client, alice_trip, db_session):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    expense_data = {
        "title": "Bistro Dinner",
        "amount": "142.75",
        "category": "Food",
        "expense_date": "2027-05-02",
        "description": "Dinner at Le Gabriel",
    }
    res = client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json=expense_data)
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Bistro Dinner"
    assert Decimal(str(data["amount"])) == Decimal("142.75")
    assert data["category"] == "Food"

    # Verify directly from PostgreSQL
    exp_in_db = db_session.query(Expense).filter(Expense.id == UUID(data["id"])).first()
    assert exp_in_db is not None
    assert exp_in_db.amount == Decimal("142.75")


def test_expense_date_range_validation(client, alice_trip):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    # Trip is 2027-05-01 to 2027-05-10
    early_data = {
        "title": "Early Train Ticket",
        "amount": "50.00",
        "category": "Transportation",
        "expense_date": "2027-04-30",
    }
    res = client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json=early_data)
    assert res.status_code == 400
    assert "must be between trip start date" in res.json()["detail"]


def test_sql_aggregation_and_budget_summary(client, alice_trip):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    # Alice adds 3 expenses across categories:
    # Food: 120.50 + 79.50 = 200.00
    # Transport: 300.00
    # Total = 500.00, Budget = 2500.00, Remaining = 2000.00, 20%
    client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json={
        "title": "Lunch",
        "amount": "120.50",
        "category": "Food",
        "expense_date": "2027-05-02",
    })
    client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json={
        "title": "Dinner",
        "amount": "79.50",
        "category": "Food",
        "expense_date": "2027-05-02",
    })
    client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json={
        "title": "TGV Ticket",
        "amount": "300.00",
        "category": "Transportation",
        "expense_date": "2027-05-03",
    })

    res = client.get(f"/api/v1/trips/{alice_trip.id}/expenses/summary")
    assert res.status_code == 200
    summary = res.json()

    assert Decimal(str(summary["budget"])) == Decimal("2500.00")
    assert Decimal(str(summary["total_spent"])) == Decimal("500.00")
    assert Decimal(str(summary["remaining_budget"])) == Decimal("2000.00")
    assert summary["percent_spent"] == 20.0
    assert summary["is_over_budget"] is False
    assert summary["expense_count"] == 3

    # Check category grouping
    categories = {cat["category"]: cat for cat in summary["by_category"]}
    assert "Transportation" in categories
    assert Decimal(str(categories["Transportation"]["total"])) == Decimal("300.00")
    assert categories["Transportation"]["count"] == 1
    assert categories["Transportation"]["percentage"] == 60.0

    assert "Food" in categories
    assert Decimal(str(categories["Food"]["total"])) == Decimal("200.00")
    assert categories["Food"]["count"] == 2
    assert categories["Food"]["percentage"] == 40.0


def test_authorization_prevents_bob_access(client, alice_trip):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    exp_res = client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json={
        "title": "Louvre Tickets",
        "amount": "45.00",
        "category": "Activities",
        "expense_date": "2027-05-04",
    })
    assert exp_res.status_code == 201
    expense_id = exp_res.json()["id"]

    # Bob attempts to access Alice's expenses
    app.dependency_overrides[get_current_user_id] = lambda: USER_BOB

    assert client.get(f"/api/v1/trips/{alice_trip.id}/expenses").status_code == 404
    assert client.get(f"/api/v1/trips/{alice_trip.id}/expenses/{expense_id}").status_code == 404
    assert client.get(f"/api/v1/trips/{alice_trip.id}/expenses/summary").status_code == 404
    assert client.delete(f"/api/v1/trips/{alice_trip.id}/expenses/{expense_id}").status_code == 404


def test_unauthenticated_rejected(client, alice_trip):
    # No auth header/override
    assert client.get(f"/api/v1/trips/{alice_trip.id}/expenses").status_code == 401
    assert client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json={
        "title": "Coffee",
        "amount": "5.00",
        "category": "Food",
        "expense_date": "2027-05-02",
    }).status_code == 401


def test_cascade_delete_expenses_with_trip(client, alice_trip, db_session):
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE
    res = client.post(f"/api/v1/trips/{alice_trip.id}/expenses", json={
        "title": "Souvenir",
        "amount": "25.00",
        "category": "Shopping",
        "expense_date": "2027-05-05",
    })
    expense_id = UUID(res.json()["id"])

    # Delete the trip
    assert client.delete(f"/api/v1/trips/{alice_trip.id}").status_code == 204

    # Verify expense is deleted from database
    assert db_session.query(Expense).filter(Expense.id == expense_id).first() is None
