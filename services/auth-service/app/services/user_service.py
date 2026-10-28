from datetime import datetime, timezone
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from app.core.security import hash_password, verify_password
from app.models.schemas import PreferencesUpdate, ProfileUpdate, UserRegister
from app.models.user import User, UserAvatar


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UserRepository:
    def get_by_email(self, db: Session, email: str) -> Optional[User]:
        return db.query(User).filter(User.email == email.lower().strip()).first()

    def get_by_id(self, db: Session, user_id: UUID) -> Optional[User]:
        return db.query(User).filter(User.id == user_id).first()

    def create(self, db: Session, user_in: UserRegister) -> User:
        user = User(
            email=user_in.email.lower().strip(),
            hashed_password=hash_password(user_in.password),
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def authenticate(self, db: Session, email: str, password: str) -> Optional[User]:
        user = self.get_by_email(db, email)
        if not user:
            return None
        if not verify_password(password, user.hashed_password):
            return None
        return user

    # ── Profile & preferences ────────────────────────────────────────────

    def update_profile(self, db: Session, user: User, data: ProfileUpdate) -> User:
        for field in data.model_fields_set:
            setattr(user, field, getattr(data, field))
        user.updated_at = _now()
        db.commit()
        db.refresh(user)
        return user

    def update_preferences(self, db: Session, user: User, data: PreferencesUpdate) -> User:
        for field in data.model_fields_set:
            setattr(user, field, getattr(data, field))
        user.updated_at = _now()
        db.commit()
        db.refresh(user)
        return user

    # ── Password ─────────────────────────────────────────────────────────

    def change_password(self, db: Session, user: User, new_password: str) -> User:
        """Re-hashes the password and bumps the token version, which signs out other sessions."""
        user.hashed_password = hash_password(new_password)
        user.token_version = (user.token_version or 0) + 1
        user.password_changed_at = _now()
        user.updated_at = _now()
        db.commit()
        db.refresh(user)
        return user

    # ── Avatar ───────────────────────────────────────────────────────────

    def set_avatar(self, db: Session, user: User, content_type: str, data: bytes) -> User:
        if user.avatar is None:
            user.avatar = UserAvatar(user_id=user.id, content_type=content_type, data=data, updated_at=_now())
        else:
            user.avatar.content_type = content_type
            user.avatar.data = data
            user.avatar.updated_at = _now()
        user.updated_at = _now()
        db.commit()
        db.refresh(user)
        return user

    def delete_avatar(self, db: Session, user: User) -> User:
        if user.avatar is not None:
            user.avatar = None
            user.updated_at = _now()
            db.commit()
            db.refresh(user)
        return user


user_repository = UserRepository()
