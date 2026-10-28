import re
from datetime import datetime
from typing import List, Literal, Optional
from uuid import UUID
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from app.core.preferences import (
    BUDGET_STYLES,
    CURRENCIES,
    THEMES,
    TRAVEL_INTERESTS,
    TRAVEL_PACES,
    is_valid_timezone,
)

# Control characters other than tab/newline never belong in names or bios.
_CONTROL_CHARS = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, description="Password must be at least 8 characters long")


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: EmailStr
    created_at: datetime

    display_name: Optional[str] = None
    bio: Optional[str] = None
    location: Optional[str] = None

    currency: str = "USD"
    timezone: str = "UTC"
    travel_interests: List[str] = []
    travel_pace: str = "balanced"
    budget_style: str = "mid_range"

    theme: str = "dark"
    sidebar_collapsed: bool = False

    # Epoch seconds of the last picture change, or null when there is no picture.
    avatar_version: Optional[int] = None


def _clean_text(value: Optional[str], *, multiline: bool = False) -> Optional[str]:
    """Trims, rejects control characters and turns blank text into null (clears the field)."""
    if value is None:
        return None
    value = value.strip()
    if _CONTROL_CHARS.search(value):
        raise ValueError("Contains characters that aren't allowed")
    if not multiline and ("\n" in value or "\r" in value):
        raise ValueError("Must be a single line")
    return value or None


class _PartialUpdate(BaseModel):
    """Only fields the client actually sent are applied (see `model_fields_set`)."""

    model_config = ConfigDict(extra="forbid")


class ProfileUpdate(_PartialUpdate):
    display_name: Optional[str] = Field(None, max_length=80)
    bio: Optional[str] = Field(None, max_length=280)
    location: Optional[str] = Field(None, max_length=100)

    @field_validator("display_name", "location")
    @classmethod
    def _single_line(cls, value):
        return _clean_text(value)

    @field_validator("bio")
    @classmethod
    def _multi_line(cls, value):
        return _clean_text(value, multiline=True)


class PreferencesUpdate(_PartialUpdate):
    currency: Optional[str] = None
    timezone: Optional[str] = None
    travel_interests: Optional[List[str]] = None
    travel_pace: Optional[Literal[TRAVEL_PACES]] = None  # type: ignore[valid-type]
    budget_style: Optional[Literal[BUDGET_STYLES]] = None  # type: ignore[valid-type]
    theme: Optional[Literal[THEMES]] = None  # type: ignore[valid-type]
    sidebar_collapsed: Optional[bool] = None

    @field_validator("currency")
    @classmethod
    def _currency(cls, value):
        if value is None:
            return value
        value = value.strip().upper()
        if value not in CURRENCIES:
            raise ValueError("Unsupported currency")
        return value

    @field_validator("timezone")
    @classmethod
    def _timezone(cls, value):
        if value is None:
            return value
        value = value.strip()
        if not is_valid_timezone(value):
            raise ValueError("Unknown timezone")
        return value

    @field_validator("travel_interests")
    @classmethod
    def _interests(cls, value):
        if value is None:
            return value
        unknown = [v for v in value if v not in TRAVEL_INTERESTS]
        if unknown:
            raise ValueError(f"Unknown interest: {unknown[0]}")
        # De-duplicate but keep the order the user chose.
        return list(dict.fromkeys(value))

    @model_validator(mode="after")
    def _no_nulls(self):
        # Every preference has a value; "null" is not a way to clear one.
        for name in self.model_fields_set:
            if getattr(self, name) is None:
                raise ValueError(f"{name} cannot be null")
        return self


class PasswordChange(BaseModel):
    model_config = ConfigDict(extra="forbid")

    current_password: str = Field(..., min_length=1, max_length=128)
    new_password: str = Field(..., min_length=8, max_length=128)

    @field_validator("new_password")
    @classmethod
    def _strength(cls, value):
        if not re.search(r"[A-Za-z]", value) or not re.search(r"\d", value):
            raise ValueError("Password must contain at least one letter and one number")
        return value

    @model_validator(mode="after")
    def _different(self):
        if self.current_password == self.new_password:
            raise ValueError("New password must be different from the current password")
        return self
