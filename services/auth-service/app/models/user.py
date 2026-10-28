import uuid
from datetime import datetime, timezone
from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, Integer, LargeBinary, String, false, text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from app.core.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    created_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    # Profile
    display_name = Column(String(80), nullable=True)
    bio = Column(String(280), nullable=True)
    location = Column(String(100), nullable=True)

    # Preferences
    currency = Column(String(3), nullable=False, default="USD", server_default="USD")
    timezone = Column(String(64), nullable=False, default="UTC", server_default="UTC")
    travel_interests = Column(JSON, nullable=False, default=list, server_default=text("'[]'"))
    travel_pace = Column(String(16), nullable=False, default="balanced", server_default="balanced")
    budget_style = Column(String(16), nullable=False, default="mid_range", server_default="mid_range")

    # Appearance
    theme = Column(String(8), nullable=False, default="dark", server_default="dark")
    sidebar_collapsed = Column(Boolean, nullable=False, default=False, server_default=false())

    # Bumped whenever the password changes; tokens carry the version they were issued under,
    # so changing the password signs out every other session.
    token_version = Column(Integer, nullable=False, default=0, server_default="0")
    password_changed_at = Column(DateTime(timezone=True), nullable=True)
    updated_at = Column(DateTime(timezone=True), nullable=True)

    avatar = relationship(
        "UserAvatar", uselist=False, cascade="all, delete-orphan", lazy="joined", back_populates="user"
    )

    @property
    def avatar_version(self) -> int | None:
        """Changes whenever the picture does; lets clients cache the image safely."""
        if self.avatar is None:
            return None
        return int(self.avatar.updated_at.timestamp())

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}')>"


class UserAvatar(Base):
    """Profile picture, kept out of `users` so ordinary user queries never load the bytes."""

    __tablename__ = "user_avatars"

    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    content_type = Column(String(32), nullable=False)
    data = Column(LargeBinary, nullable=False)
    updated_at = Column(DateTime(timezone=True), default=_utcnow, nullable=False)

    user = relationship("User", back_populates="avatar")
