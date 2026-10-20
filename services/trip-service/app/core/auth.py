from typing import Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
import jwt

from app.core.config import settings

security = HTTPBearer(auto_error=False)


def get_current_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> UUID:
    """Enforce authentication on protected endpoints and return the user UUID."""
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials
    try:
        payload = jwt.decode(token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id_str: str = payload.get("sub")
        token_type: str = payload.get("type")
        if not user_id_str or token_type != "access":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token type or missing subject",
            )
        return UUID(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


def get_optional_user_id(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> Optional[UUID]:
    """Optional authentication for endpoints that support both public and authenticated queries."""
    if not credentials:
        return None
    try:
        payload = jwt.decode(credentials.credentials, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm])
        user_id_str = payload.get("sub")
        return UUID(user_id_str) if user_id_str else None
    except Exception:
        return None
