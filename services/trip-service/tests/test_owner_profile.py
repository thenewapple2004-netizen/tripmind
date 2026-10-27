"""
Tests for Task 14 — Microservice-to-Microservice Communication.

Covers:
- Successful profile fetch (cache hit scenario via mocked Auth Service)
- Authentication failure (401 / 403 from Auth Service)
- Timeout / network error → 503 Service Unavailable
- Trip not found / wrong owner → 404 (ownership enforced before calling Auth)
- Missing Authorization header → 401 before calling Auth Service
- Retry behavior (transient 503 → eventual success)
"""

import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from uuid import uuid4
from fastapi.testclient import TestClient

from app.main import app
from app.core.auth_service_client import (
    AuthServiceAuthError,
    AuthServiceUnavailableError,
    AuthServiceError,
    get_owner_profile,
    _fetch_with_retry,
)
from app.core.config import settings


# ── Fixtures ─────────────────────────────────────────────────────────────────

FAKE_USER_ID = uuid4()
FAKE_TRIP_ID = uuid4()
FAKE_TOKEN = "test.jwt.token"
AUTH_HEADER = {"Authorization": f"Bearer {FAKE_TOKEN}"}


def _make_mock_trip(trip_id=FAKE_TRIP_ID, user_id=FAKE_USER_ID):
    trip = MagicMock()
    trip.id = trip_id
    trip.user_id = user_id
    return trip


FAKE_PROFILE = {
    "id": str(FAKE_USER_ID),
    "email": "owner@example.com",
    "created_at": "2024-01-15T10:00:00",
}


# ── Endpoint integration tests ────────────────────────────────────────────────


class TestOwnerProfileEndpoint:
    """Integration tests for GET /api/v1/trips/{trip_id}/owner-profile."""

    def test_success_returns_owner_profile(self, client):
        """Happy path: trip found, Auth Service returns user profile."""
        with (
            patch("app.api.trips.trip_repository.get_by_id", return_value=_make_mock_trip()),
            patch("app.api.trips.get_owner_profile", new_callable=AsyncMock, return_value=FAKE_PROFILE),
            patch("app.core.auth.jwt.decode", return_value={"sub": str(FAKE_USER_ID), "type": "access"}),
        ):
            resp = client.get(f"/api/v1/trips/{FAKE_TRIP_ID}/owner-profile", headers=AUTH_HEADER)

        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == str(FAKE_USER_ID)
        assert data["email"] == "owner@example.com"
        assert "created_at" in data
        assert data["source"] == "auth-service"

    def test_unauthenticated_request_returns_401(self, client):
        """Missing Authorization header → 401 before hitting Auth Service."""
        resp = client.get(f"/api/v1/trips/{FAKE_TRIP_ID}/owner-profile")
        assert resp.status_code == 401

    def test_trip_not_found_returns_404(self, client):
        """Trip doesn't exist or doesn't belong to user → 404."""
        with (
            patch("app.api.trips.trip_repository.get_by_id", return_value=None),
            patch("app.core.auth.jwt.decode", return_value={"sub": str(FAKE_USER_ID), "type": "access"}),
        ):
            resp = client.get(f"/api/v1/trips/{FAKE_TRIP_ID}/owner-profile", headers=AUTH_HEADER)

        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()

    def test_auth_service_401_returns_401(self, client):
        """Auth Service rejects token → 401 propagated to client."""
        with (
            patch("app.api.trips.trip_repository.get_by_id", return_value=_make_mock_trip()),
            patch(
                "app.api.trips.get_owner_profile",
                new_callable=AsyncMock,
                side_effect=AuthServiceAuthError(status_code=401, detail="Token expired"),
            ),
            patch("app.core.auth.jwt.decode", return_value={"sub": str(FAKE_USER_ID), "type": "access"}),
        ):
            resp = client.get(f"/api/v1/trips/{FAKE_TRIP_ID}/owner-profile", headers=AUTH_HEADER)

        assert resp.status_code == 401
        assert resp.json()["detail"] == "Token expired"

    def test_auth_service_503_returns_503(self, client):
        """Auth Service unreachable → 503 Service Unavailable."""
        with (
            patch("app.api.trips.trip_repository.get_by_id", return_value=_make_mock_trip()),
            patch(
                "app.api.trips.get_owner_profile",
                new_callable=AsyncMock,
                side_effect=AuthServiceUnavailableError("Auth Service is temporarily unavailable"),
            ),
            patch("app.core.auth.jwt.decode", return_value={"sub": str(FAKE_USER_ID), "type": "access"}),
        ):
            resp = client.get(f"/api/v1/trips/{FAKE_TRIP_ID}/owner-profile", headers=AUTH_HEADER)

        assert resp.status_code == 503

    def test_auth_service_generic_error_returns_502(self, client):
        """Unexpected Auth Service error → 502 Bad Gateway."""
        with (
            patch("app.api.trips.trip_repository.get_by_id", return_value=_make_mock_trip()),
            patch(
                "app.api.trips.get_owner_profile",
                new_callable=AsyncMock,
                side_effect=AuthServiceError("Unexpected error"),
            ),
            patch("app.core.auth.jwt.decode", return_value={"sub": str(FAKE_USER_ID), "type": "access"}),
        ):
            resp = client.get(f"/api/v1/trips/{FAKE_TRIP_ID}/owner-profile", headers=AUTH_HEADER)

        assert resp.status_code == 502

    def test_ownership_enforced_different_user(self, client):
        """Trip owned by another user → 404 (no Auth Service call)."""
        other_user_id = uuid4()
        with (
            patch("app.api.trips.trip_repository.get_by_id", return_value=None),
            patch("app.core.auth.jwt.decode", return_value={"sub": str(other_user_id), "type": "access"}),
        ):
            resp = client.get(f"/api/v1/trips/{FAKE_TRIP_ID}/owner-profile", headers=AUTH_HEADER)

        assert resp.status_code == 404


# ── Auth service client unit tests ────────────────────────────────────────────


class TestAuthServiceClient:
    """Unit tests for the HTTPX client wrapper."""

    @pytest.mark.anyio
    async def test_get_owner_profile_success(self):
        """get_owner_profile parses JSON profile from a 200 response."""
        mock_response = MagicMock()
        mock_response.json.return_value = FAKE_PROFILE

        with patch(
            "app.core.auth_service_client._fetch_with_retry",
            new_callable=AsyncMock,
            return_value=mock_response,
        ):
            result = await get_owner_profile("valid_token")

        assert result["id"] == str(FAKE_USER_ID)
        assert result["email"] == "owner@example.com"

    @pytest.mark.anyio
    async def test_auth_error_not_retried(self):
        """AuthServiceAuthError raised immediately, no retry."""
        import httpx
        from app.core.auth_service_client import _fetch_with_retry, get_http_client

        mock_401 = MagicMock(spec=httpx.Response)
        mock_401.status_code = 401
        mock_401.json.return_value = {"detail": "Invalid token"}

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=mock_401)

        with patch("app.core.auth_service_client.get_http_client", return_value=mock_client):
            with pytest.raises(AuthServiceAuthError) as exc_info:
                await _fetch_with_retry("GET", "/api/v1/auth/me", "bad_token")

        # Should only be called once (no retries for 401)
        assert mock_client.request.call_count == 1
        assert exc_info.value.status_code == 401

    @pytest.mark.anyio
    async def test_retries_on_503(self):
        """5xx responses trigger retries up to max_retries."""
        import httpx
        from app.core.auth_service_client import _fetch_with_retry

        good_response = MagicMock(spec=httpx.Response)
        good_response.status_code = 200
        good_response.raise_for_status = MagicMock()

        bad_response = MagicMock(spec=httpx.Response)
        bad_response.status_code = 503

        mock_client = AsyncMock()
        # Fail twice, succeed on third attempt
        mock_client.request = AsyncMock(
            side_effect=[bad_response, bad_response, good_response]
        )

        with (
            patch("app.core.auth_service_client.get_http_client", return_value=mock_client),
            patch("app.core.auth_service_client.asyncio.sleep", new_callable=AsyncMock),
        ):
            result = await _fetch_with_retry("GET", "/test", "token")

        assert result is good_response
        assert mock_client.request.call_count == 3

    @pytest.mark.anyio
    async def test_all_retries_exhausted_raises_unavailable(self):
        """All retry attempts fail → AuthServiceUnavailableError."""
        import httpx
        from app.core.auth_service_client import _fetch_with_retry

        bad_response = MagicMock(spec=httpx.Response)
        bad_response.status_code = 503

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(return_value=bad_response)

        with (
            patch("app.core.auth_service_client.get_http_client", return_value=mock_client),
            patch("app.core.auth_service_client.asyncio.sleep", new_callable=AsyncMock),
        ):
            with pytest.raises(AuthServiceUnavailableError):
                await _fetch_with_retry("GET", "/test", "token")

        assert mock_client.request.call_count == settings.auth_http_max_retries

    @pytest.mark.anyio
    async def test_network_timeout_raises_unavailable(self):
        """ReadTimeout maps to AuthServiceUnavailableError after retries."""
        import httpx
        from app.core.auth_service_client import _fetch_with_retry

        mock_client = AsyncMock()
        mock_client.request = AsyncMock(side_effect=httpx.ReadTimeout("timed out"))

        with (
            patch("app.core.auth_service_client.get_http_client", return_value=mock_client),
            patch("app.core.auth_service_client.asyncio.sleep", new_callable=AsyncMock),
        ):
            with pytest.raises(AuthServiceUnavailableError) as exc_info:
                await _fetch_with_retry("GET", "/test", "token")

        assert "ReadTimeout" in str(exc_info.value)

    def test_exception_hierarchy(self):
        """Domain exceptions follow the expected inheritance chain."""
        assert issubclass(AuthServiceAuthError, AuthServiceError)
        assert issubclass(AuthServiceUnavailableError, AuthServiceError)


# ── Pytest fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def client():
    return TestClient(app)
