from pydantic import Field

from app.schemas.common import CamelModel


class LoginRequest(CamelModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class UserOut(CamelModel):
    id: int
    email: str
    full_name: str
    role: str
    store_id: int | None = None
    store_name: str | None = None
    membership_tier: str | None = None
    country_code: str | None = None
    city: str | None = None
    preferred_store_id: int | None = None
    preferences: dict = Field(default_factory=dict)


class LoginResponse(CamelModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class Preferences(CamelModel):
    favorite_categories: list[str] = Field(default_factory=list, max_length=10)
    favorite_brands: list[str] = Field(default_factory=list, max_length=10)
    budget_max: float | None = Field(default=None, ge=0)


class ProfileUpdate(CamelModel):
    preferred_store_id: int | None = None
    preferences: Preferences | None = None
