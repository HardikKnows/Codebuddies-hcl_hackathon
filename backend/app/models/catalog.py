from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Computed, DateTime, ForeignKey, Index, Numeric, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import StoreType, check_in


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(60), unique=True)
    name: Mapped[str] = mapped_column(String(80))
    parent_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))

    parent: Mapped["Category | None"] = relationship(remote_side=[id])


class Brand(Base):
    __tablename__ = "brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(80), unique=True)


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        CheckConstraint("price >= 0", name="price_non_negative"),
        CheckConstraint("rating_avg BETWEEN 0 AND 5", name="rating_range"),
        Index("ix_products_search_vector", "search_vector", postgresql_using="gin"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    sku: Mapped[str] = mapped_column(String(20), unique=True)  # public product id, e.g. "P101"
    name: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text, server_default="")
    category_id: Mapped[int] = mapped_column(ForeignKey("categories.id"), index=True)
    brand_id: Mapped[int] = mapped_column(ForeignKey("brands.id"), index=True)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), index=True)
    specifications: Mapped[dict] = mapped_column(JSONB, server_default="{}")
    image_url: Mapped[str | None] = mapped_column(String(500))
    rating_avg: Mapped[Decimal] = mapped_column(Numeric(2, 1), server_default="0")
    rating_count: Mapped[int] = mapped_column(server_default="0")
    is_active: Mapped[bool] = mapped_column(server_default="true")
    search_vector: Mapped[str] = mapped_column(
        TSVECTOR, Computed("to_tsvector('english', coalesce(name, '') || ' ' || coalesce(description, ''))", persisted=True)
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category: Mapped[Category] = relationship()
    brand: Mapped[Brand] = relationship()
    inventory: Mapped[list["Inventory"]] = relationship(back_populates="product")


class Store(Base):
    __tablename__ = "stores"
    __table_args__ = (check_in("type", StoreType),)

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True)
    name: Mapped[str] = mapped_column(String(120))
    type: Mapped[str] = mapped_column(String(20))
    country_code: Mapped[str] = mapped_column(String(2))
    city: Mapped[str] = mapped_column(String(80))
    address: Mapped[str] = mapped_column(String(255))


class Inventory(Base):
    """Stock per location. Availability status is always derived from these rows, never stored on products."""

    __tablename__ = "inventory"
    __table_args__ = (
        CheckConstraint("quantity >= 0", name="quantity_non_negative"),
        CheckConstraint("reorder_level >= 0", name="reorder_level_non_negative"),
    )

    store_id: Mapped[int] = mapped_column(ForeignKey("stores.id", ondelete="CASCADE"), primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), primary_key=True, index=True)
    quantity: Mapped[int]
    reorder_level: Mapped[int] = mapped_column(server_default="5")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    store: Mapped[Store] = relationship()
    product: Mapped[Product] = relationship(back_populates="inventory")
