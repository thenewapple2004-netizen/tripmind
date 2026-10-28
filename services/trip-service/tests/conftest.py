"""
Fixtures for the planner tests (itinerary, checklist, documents).

They run against an in-memory SQLite database, never the development Postgres, and they sign real
JWTs with the service's secret so the genuine authentication and trip-ownership checks are
exercised (no dependency overrides for auth). Fixture names are prefixed `planner_` so they cannot
collide with the older test modules, which define their own.
"""

from datetime import date, timedelta
from decimal import Decimal
from uuid import UUID, uuid4

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core import cache
from app.core.config import settings
from app.core.database import Base, get_db
from app.main import app
from app.models.trip import Trip

ALICE = UUID("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa")
BOB = UUID("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb")

_engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
_Session = sessionmaker(autocommit=False, autoflush=False, bind=_engine)


def auth_header(user_id: UUID) -> dict:
    token = jwt.encode({"sub": str(user_id), "type": "access"}, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def planner_db():
    Base.metadata.create_all(bind=_engine)
    db = _Session()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=_engine)


@pytest.fixture
def planner_client(planner_db, monkeypatch):
    # Redis isn't part of these tests; make the cache calls instant no-ops.
    monkeypatch.setattr(cache, "delete_cache", lambda key: True)
    monkeypatch.setattr(cache, "get_cache", lambda key: None)
    monkeypatch.setattr(cache, "set_cache", lambda key, value, ttl=None: True)

    def override_get_db():
        yield planner_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture
def make_trip(planner_db):
    def _make(owner: UUID = ALICE, start: date = date(2027, 5, 10), days: int = 5, title: str = "Planner Trip") -> Trip:
        trip = Trip(
            id=uuid4(),
            user_id=owner,
            title=title,
            destination="Hunza Valley, Gilgit-Baltistan",
            start_date=start,
            end_date=start + timedelta(days=days - 1),
            budget=Decimal("1000.00"),
        )
        planner_db.add(trip)
        planner_db.commit()
        planner_db.refresh(trip)
        return trip

    return _make


@pytest.fixture
def alice_trip(make_trip):
    return make_trip(ALICE)


@pytest.fixture
def bob_trip(make_trip):
    return make_trip(BOB, title="Bob's Trip")


@pytest.fixture
def alice():
    return auth_header(ALICE)


@pytest.fixture
def bob():
    return auth_header(BOB)
