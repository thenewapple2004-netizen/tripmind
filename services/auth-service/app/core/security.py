from datetime import datetime, timedelta, timezone
from typing import Any, Dict, Optional
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError
from app.core.config import settings

# Argon2 password hasher instance
ph = PasswordHasher()


def hash_password(password: str) -> str:
    """Hash password using Argon2."""
    return ph.hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against Argon2 hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, Exception):
        return False


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def create_refresh_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT refresh token."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta if expires_delta else timedelta(days=settings.refresh_token_expire_days)
    )
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.jwt_secret_key, algorithm=settings.jwt_algorithm)


def decode_token(token: str) -> Dict[str, Any]:
    """Decode and validate a JWT token."""
    return jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
