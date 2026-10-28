from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session
import jwt

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.core.avatar import MAX_AVATAR_BYTES, sniff_image_type
from app.core.security import verify_password
from app.models.schemas import (
    PasswordChange,
    PreferencesUpdate,
    ProfileUpdate,
    RefreshTokenRequest,
    TokenResponse,
    UserLogin,
    UserRegister,
    UserResponse,
)
from app.models.user import User
from app.services.user_service import user_repository

router = APIRouter(prefix="/auth", tags=["Authentication"])


def _issue_tokens(user: User) -> TokenResponse:
    ver = user.token_version or 0
    return TokenResponse(
        access_token=create_access_token(data={"sub": str(user.id), "email": user.email, "ver": ver}),
        refresh_token=create_refresh_token(data={"sub": str(user.id), "ver": ver}),
    )


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: UserRegister, db: Session = Depends(get_db)):
    existing = user_repository.get_by_email(db, user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists"
        )
    return user_repository.create(db, user_in)


@router.post("/login", response_model=TokenResponse)
def login(login_in: UserLogin, db: Session = Depends(get_db)):
    user = user_repository.authenticate(db, login_in.email, login_in.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _issue_tokens(user)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(refresh_in: RefreshTokenRequest, db: Session = Depends(get_db)):
    try:
        payload = decode_token(refresh_in.refresh_token)
        user_id_str: str = payload.get("sub")
        token_type: str = payload.get("type")
        if user_id_str is None or token_type != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token",
            )
        user_id = UUID(user_id_str)
    except (jwt.PyJWTError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    user = user_repository.get_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User no longer exists",
        )
    # A refresh token from before a password change must not keep a session alive.
    if payload.get("ver", 0) != (user.token_version or 0):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired refresh token",
        )

    return _issue_tokens(user)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.patch("/me", response_model=UserResponse)
def update_me(
    data: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update display name, bio and location. Only the fields sent are changed."""
    return user_repository.update_profile(db, current_user, data)


@router.patch("/me/preferences", response_model=UserResponse)
def update_preferences(
    data: PreferencesUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update travel preferences, currency, timezone and appearance."""
    return user_repository.update_preferences(db, current_user, data)


@router.post("/me/password", response_model=TokenResponse)
def change_password(
    data: PasswordChange,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the password. Requires the current one; signs out every other session."""
    if not verify_password(data.current_password, current_user.hashed_password):
        # 400 rather than 401: the caller is authenticated, the submitted field is wrong.
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    user = user_repository.change_password(db, current_user, data.new_password)
    return _issue_tokens(user)


@router.put("/me/avatar", response_model=UserResponse)
async def upload_avatar(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a profile picture as the raw request body (PNG, JPEG or WebP, up to 1 MB)."""
    declared = request.headers.get("content-length")
    if declared and declared.isdigit() and int(declared) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large (max 1 MB)")

    body = b""
    async for chunk in request.stream():
        body += chunk
        if len(body) > MAX_AVATAR_BYTES:
            raise HTTPException(status_code=413, detail="Image is too large (max 1 MB)")
    if not body:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No image was uploaded")

    # Trust the bytes, not the header: the file must really be an image of an allowed type.
    content_type = sniff_image_type(body)
    if content_type is None:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail="Unsupported image. Use PNG, JPEG or WebP.",
        )
    return user_repository.set_avatar(db, current_user, content_type, body)


@router.get("/me/avatar")
def get_avatar(current_user: User = Depends(get_current_user)):
    if current_user.avatar is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No profile picture")
    return Response(
        content=current_user.avatar.data,
        media_type=current_user.avatar.content_type,
        headers={"Cache-Control": "private, max-age=3600", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/me/avatar", response_model=UserResponse)
def delete_avatar(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return user_repository.delete_avatar(db, current_user)
