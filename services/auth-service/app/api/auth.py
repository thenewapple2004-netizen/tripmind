from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import jwt

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, create_refresh_token, decode_token
from app.models.schemas import RefreshTokenRequest, TokenResponse, UserLogin, UserRegister, UserResponse
from app.models.user import User
from app.services.user_service import user_repository

router = APIRouter(prefix="/auth", tags=["Authentication"])


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

    access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


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

    new_access_token = create_access_token(data={"sub": str(user.id), "email": user.email})
    new_refresh_token = create_refresh_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=new_access_token, refresh_token=new_refresh_token)


@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user
