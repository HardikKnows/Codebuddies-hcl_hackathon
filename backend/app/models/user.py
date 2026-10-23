from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, DateTime, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import MembershipTier, Role, check_in


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        check_in("role", Role),
        CheckConstraint("role IN ('CUSTOMER', 'ADMIN') OR store_id IS NOT NULL", name="staff_has_store"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True)  # stored lowercase
    password_hash: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    role: Mapped[str] = mapped_column(String(20))
    store_id: Mapped[int | None] = mapped_column(ForeignKey("stores.id"))  # staff's assigned store
    is_active: Mapped[bool] = mapped_column(Boolean, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    store = relationship("Store")
    profile: Mapped["CustomerProfile | None"] = relationship(back_populates="user", uselist=False)


class CustomerProfile(Base):
    __tablename__ = "customer_profiles"
    __table_args__ = (check_in("membership_tier", MembershipTier),)

    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    membership_tier: Mapped[str] = mapped_column(String(20), server_default=MembershipTier.STANDARD.value)
    country_code: Mapped[str] = mapped_column(String(2))
    city: Mapped[str | None] = mapped_column(String(80))
    preferred_store_id: Mapped[int | None] = mapped_column(ForeignKey("stores.id"))
    preferences: Mapped[dict] = mapped_column(JSONB, server_default="{}")

    user: Mapped[User] = relationship(back_populates="profile")
    preferred_store = relationship("Store")
