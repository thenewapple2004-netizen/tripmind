"""
auth_service_client.py
======================
HTTP client for Trip Service → Auth Service communication.

Design principles:
- Uses a single shared ``httpx.AsyncClient`` (connection pool) per process.
- Forwards the caller's JWT Bearer token; Trip Service never stores credentials.
- Exponential back-off retries on *transient* network / 5xx errors only.
- Raises domain-specific exceptions so callers can decide how to respond.
- Hard timeout on every request to prevent cascading slow-downs.
- Logs warnings/errors without ever leaking token values.
"""

import asyncio
import logging
from typing import Any

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)

# ── Shared async client (one pool per process) ─────────────────────────────

_client: httpx.AsyncClient | None = None


def get_http_client() -> httpx.AsyncClient:
    """Return (or lazily create) the shared HTTPX async client."""
    global _client
    if _client is None or _client.is_closed:
        _client = httpx.AsyncClient(
            base_url=settings.auth_service_url,
            timeout=httpx.Timeout(settings.auth_http_timeout),
            headers={"User-Agent": "TripService/1.0"},
        )
    return _client


async def close_http_client() -> None:
    """Gracefully close the shared client on application shutdown."""
    global _client
    if _client and not _client.is_closed:
        await _client.aclose()
        _client = None


# ── Domain exceptions ───────────────────────────────────────────────────────


class AuthServiceError(Exception):
    """Base class for Auth Service communication errors."""


class AuthServiceAuthError(AuthServiceError):
    """Raised when the Auth Service returns 401 / 403 (bad / expired token)."""

    def __init__(self, status_code: int, detail: str = "Authentication failed"):
        self.status_code = status_code
        super().__init__(detail)


class AuthServiceUnavailableError(AuthServiceError):
    """Raised when the Auth Service cannot be reached or returns a 5xx."""

    def __init__(self, detail: str = "Auth Service is temporarily unavailable"):
        super().__init__(detail)


# ── Core fetch helper ────────────────────────────────────────────────────────

_RETRYABLE_STATUS = {429, 500, 502, 503, 504}
_RETRYABLE_ERRORS = (
    httpx.ConnectError,
    httpx.ReadTimeout,
    httpx.WriteTimeout,
    httpx.PoolTimeout,
    httpx.RemoteProtocolError,
)


async def _fetch_with_retry(
    method: str,
    path: str,
    bearer_token: str,
    **kwargs: Any,
) -> httpx.Response:
    """
    Perform an HTTP request with exponential back-off retry.

    Only transient network errors and 5xx / 429 responses are retried.
    Auth errors (401, 403) and 404s propagate immediately.
    """
    client = get_http_client()
    max_attempts = max(1, settings.auth_http_max_retries)
    backoff = settings.auth_http_backoff_factor

    # Mask the token in logs — only log the first 8 chars for traceability
    token_hint = bearer_token[:8] + "…" if len(bearer_token) > 8 else "***"

    last_exc: Exception | None = None

    for attempt in range(max_attempts):
        if attempt > 0:
            delay = backoff * (2 ** (attempt - 1))
            logger.info(
                "auth_client: retry %d/%d for %s %s in %.2fs",
                attempt,
                max_attempts - 1,
                method.upper(),
                path,
                delay,
            )
            await asyncio.sleep(delay)

        try:
            response = await client.request(
                method,
                path,
                headers={"Authorization": f"Bearer {bearer_token}"},
                **kwargs,
            )

            if response.status_code in (401, 403):
                logger.warning(
                    "auth_client: %s returned %d (token=%s)",
                    path,
                    response.status_code,
                    token_hint,
                )
                raise AuthServiceAuthError(
                    status_code=response.status_code,
                    detail=_extract_detail(response, "Authentication error"),
                )

            if response.status_code in _RETRYABLE_STATUS:
                logger.warning(
                    "auth_client: %s returned %d — will retry (attempt %d)",
                    path,
                    response.status_code,
                    attempt + 1,
                )
                last_exc = AuthServiceUnavailableError(
                    f"Auth Service responded with HTTP {response.status_code}"
                )
                continue  # retry

            response.raise_for_status()
            return response

        except AuthServiceAuthError:
            raise  # never retry auth errors
        except _RETRYABLE_ERRORS as exc:
            logger.warning(
                "auth_client: network error on %s %s (attempt %d): %s",
                method.upper(),
                path,
                attempt + 1,
                type(exc).__name__,
            )
            last_exc = AuthServiceUnavailableError(
                f"Network error communicating with Auth Service: {type(exc).__name__}"
            )
        except httpx.HTTPStatusError as exc:
            # Non-retryable HTTP error (e.g. 400, 404)
            logger.error(
                "auth_client: non-retryable HTTP error %d on %s",
                exc.response.status_code,
                path,
            )
            raise AuthServiceError(
                f"Auth Service returned HTTP {exc.response.status_code}"
            ) from exc

    # All attempts exhausted
    logger.error(
        "auth_client: all %d attempts failed for %s %s",
        max_attempts,
        method.upper(),
        path,
    )
    raise last_exc or AuthServiceUnavailableError()


def _extract_detail(response: httpx.Response, fallback: str) -> str:
    """Safely pull a 'detail' field from a JSON error body."""
    try:
        return response.json().get("detail", fallback)
    except Exception:
        return fallback


# ── Public API ───────────────────────────────────────────────────────────────


async def get_owner_profile(bearer_token: str) -> dict:
    """
    Fetch the authenticated user's profile from the Auth Service.

    Forwards the caller's access token to ``GET /api/v1/auth/me``.
    The Trip Service never stores or logs the token value.

    Returns:
        A dict with ``id``, ``email``, and ``created_at`` fields.

    Raises:
        AuthServiceAuthError: token is invalid or expired.
        AuthServiceUnavailableError: service unreachable after all retries.
        AuthServiceError: any other unexpected error.
    """
    response = await _fetch_with_retry("GET", "/api/v1/auth/me", bearer_token)
    data: dict = response.json()
    logger.debug(
        "auth_client: fetched profile for user_id=%s", data.get("id", "?")
    )
    return data
