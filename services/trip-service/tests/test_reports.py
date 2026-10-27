from datetime import date
from decimal import Decimal
import os
from unittest.mock import MagicMock, patch
from uuid import UUID, uuid4
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.activity import Activity
from app.models.expense import Expense
from app.models.trip import Trip
from app.tasks.report_tasks import NonRetryableTaskError, generate_trip_report

SQLALCHEMY_DATABASE_URL = "postgresql+psycopg2://postgres:postgres@localhost:5433/tripmind_trips"

engine = create_engine(SQLALCHEMY_DATABASE_URL, pool_pre_ping=True)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

USER_ALICE = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
USER_BOB = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")


@pytest.fixture(autouse=True)
def override_celery_task_session():
    with patch("app.tasks.report_tasks.SessionLocal", TestingSessionLocal):
        yield


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
def alice_trip_with_data(db_session):
    trip = Trip(
        user_id=USER_ALICE,
        title="Swiss Alps Adventure",
        destination="Interlaken, Switzerland",
        start_date=date(2027, 7, 1),
        end_date=date(2027, 7, 10),
        budget=Decimal("4000.00"),
    )
    db_session.add(trip)
    db_session.commit()
    db_session.refresh(trip)

    act1 = Activity(
        trip_id=trip.id,
        title="Jungfraujoch Train",
        location="Jungfrau",
        activity_date=date(2027, 7, 2),
        cost=Decimal("210.00"),
        description="Top of Europe excursion",
    )
    act2 = Activity(
        trip_id=trip.id,
        title="Lake Brienz Kayaking",
        location="Brienz",
        activity_date=date(2027, 7, 4),
        cost=Decimal("65.00"),
        description="Afternoon paddling",
    )
    db_session.add_all([act1, act2])

    exp1 = Expense(
        trip_id=trip.id,
        title="Alpine Chalet Hotel",
        amount=Decimal("1200.00"),
        category="Accommodation",
        expense_date=date(2027, 7, 2),
        description="Booking for 5 nights",
    )
    exp2 = Expense(
        trip_id=trip.id,
        title="Swiss Fondue Dinner",
        amount=Decimal("85.50"),
        category="Food",
        expense_date=date(2027, 7, 3),
        description="Traditional Swiss cheese fondue",
    )
    db_session.add_all([exp1, exp2])
    db_session.commit()

    yield trip

    # Cleanup
    existing = db_session.query(Trip).filter(Trip.id == trip.id).first()
    if existing:
        db_session.delete(existing)
        db_session.commit()


def test_request_report_enqueues_task_and_returns_202(client, alice_trip_with_data):
    trip = alice_trip_with_data
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE

    fake_task = MagicMock()
    fake_task.id = "mock-task-id-12345"

    with patch("app.api.reports.generate_trip_report.delay", return_value=fake_task) as mock_delay:
        res = client.post(f"/api/v1/trips/{trip.id}/reports")
        assert res.status_code == 202
        data = res.json()
        assert data["task_id"] == "mock-task-id-12345"
        assert data["status"] == "PENDING"
        assert "initiated" in data["message"].lower()

        mock_delay.assert_called_once_with(str(trip.id), str(USER_ALICE))


def test_generate_trip_report_creates_valid_csv(alice_trip_with_data):
    trip = alice_trip_with_data

    # Execute task synchronously using Celery's apply()
    async_res = generate_trip_report.apply(
        args=[str(trip.id), str(USER_ALICE)],
        task_id="test-task-exec-999",
    )
    result = async_res.get()

    assert result["task_id"] == "test-task-exec-999"
    assert result["trip_id"] == str(trip.id)
    assert result["user_id"] == str(USER_ALICE)
    assert result["file_size"] > 0
    assert os.path.exists(result["file_path"])

    # Read and verify CSV content structure
    with open(result["file_path"], "r", encoding="utf-8") as f:
        content = f.read()

    # Verify sections exist
    assert "TRIP DETAILS & SUMMARY REPORT" in content
    assert "Swiss Alps Adventure" in content
    assert "Interlaken, Switzerland" in content
    assert "BUDGET OVERVIEW" in content
    assert "4000.00" in content
    assert "1285.50" in content  # 1200 + 85.50
    assert "EXPENSES BY CATEGORY" in content
    assert "Accommodation" in content
    assert "Food" in content
    assert "SCHEDULED ACTIVITIES" in content
    assert "Jungfraujoch Train" in content
    assert "Lake Brienz Kayaking" in content
    assert "ITEMIZED EXPENSES LEDGER" in content
    assert "Alpine Chalet Hotel" in content
    assert "Swiss Fondue Dinner" in content

    # Cleanup generated test file
    if os.path.exists(result["file_path"]):
        os.remove(result["file_path"])


def test_generate_trip_report_non_retryable_for_missing_trip():
    res = generate_trip_report.apply(args=[str(uuid4()), str(USER_ALICE)])
    with pytest.raises(NonRetryableTaskError) as exc_info:
        res.get()

    assert "not found or unauthorized" in str(exc_info.value)


def test_get_report_status_pending_and_success(client, alice_trip_with_data):
    trip = alice_trip_with_data
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE

    # 1. Test PENDING state
    mock_async_pending = MagicMock()
    mock_async_pending.state = "PENDING"
    mock_async_pending.result = None

    with patch("app.api.reports.AsyncResult", return_value=mock_async_pending):
        res = client.get(f"/api/v1/trips/{trip.id}/reports/task-123/status")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "PENDING"
        assert "queued" in data["message"].lower()

    # 2. Test SUCCESS state
    mock_async_success = MagicMock()
    mock_async_success.state = "SUCCESS"
    mock_async_success.result = {
        "task_id": "task-123",
        "trip_id": str(trip.id),
        "user_id": str(USER_ALICE),
        "filename": "trip_report_test.csv",
        "file_size": 1024,
        "generated_at": "2027-07-02T10:00:00Z",
        "row_counts": {"activities": 2, "expenses": 2, "categories": 2},
    }

    with patch("app.api.reports.AsyncResult", return_value=mock_async_success):
        res = client.get(f"/api/v1/trips/{trip.id}/reports/task-123/status")
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "SUCCESS"
        assert data["result"]["filename"] == "trip_report_test.csv"
        assert data["result"]["file_size"] == 1024


def test_download_report_success_and_failures(client, alice_trip_with_data, tmp_path):
    trip = alice_trip_with_data
    app.dependency_overrides[get_current_user_id] = lambda: USER_ALICE

    # 1. Download while still pending -> 400 Bad Request
    mock_async_pending = MagicMock()
    mock_async_pending.state = "PENDING"
    with patch("app.api.reports.AsyncResult", return_value=mock_async_pending):
        res = client.get(f"/api/v1/trips/{trip.id}/reports/task-456/download")
        assert res.status_code == 400
        assert "not ready yet" in res.json()["detail"].lower()

    # 2. Download after completion -> 200 OK with FileResponse
    from app.core.config import settings
    test_file = os.path.join(settings.reports_dir, "test_download.csv")
    with open(test_file, "w", encoding="utf-8") as f:
        f.write("Header1,Header2\nValue1,Value2\n")

    mock_async_success = MagicMock()
    mock_async_success.state = "SUCCESS"
    mock_async_success.result = {
        "task_id": "task-456",
        "trip_id": str(trip.id),
        "user_id": str(USER_ALICE),
        "filename": "test_download.csv",
        "file_path": test_file,
    }

    with patch("app.api.reports.AsyncResult", return_value=mock_async_success):
        res = client.get(f"/api/v1/trips/{trip.id}/reports/task-456/download")
        assert res.status_code == 200
        assert "text/csv" in res.headers["content-type"]
        assert "attachment; filename=" in res.headers["content-disposition"]
        assert "Header1,Header2" in res.text

    if os.path.exists(test_file):
        os.remove(test_file)


def test_authorization_prevents_bob_access_to_reports(client, alice_trip_with_data):
    trip = alice_trip_with_data

    # Bob attempts to request a report on Alice's trip -> 404 Not Found
    app.dependency_overrides[get_current_user_id] = lambda: USER_BOB
    res_post = client.post(f"/api/v1/trips/{trip.id}/reports")
    assert res_post.status_code == 404

    # Bob attempts to check status on Alice's trip -> 404 Not Found
    res_status = client.get(f"/api/v1/trips/{trip.id}/reports/any-task-id/status")
    assert res_status.status_code == 404

    # Bob attempts to download Alice's report -> 404 Not Found
    res_download = client.get(f"/api/v1/trips/{trip.id}/reports/any-task-id/download")
    assert res_download.status_code == 404


def test_unauthenticated_request_rejected(client, alice_trip_with_data):
    trip = alice_trip_with_data
    # No auth header or override
    res = client.post(f"/api/v1/trips/{trip.id}/reports")
    assert res.status_code == 401
