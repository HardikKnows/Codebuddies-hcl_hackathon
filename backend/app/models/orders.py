import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, Index, Numeric, String, UniqueConstraint, Uuid, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import FulfillmentType, OrderStatus, check_in


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        check_in("fulfillment_type", FulfillmentType),
        check_in("status", OrderStatus),
        CheckConstraint("fulfillment_type = 'PICKUP' OR delivery_address IS NOT NULL", name="delivery_has_address"),
        CheckConstraint("subtotal >= 0 AND shipping_fee >= 0 AND total >= 0", name="amounts_non_negative"),
        Index("ix_orders_customer_placed", "customer_id", "placed_at"),
        Index("ix_orders_store_status", "fulfillment_store_id", "status"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_number: Mapped[str] = mapped_column(String(20), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    fulfillment_type: Mapped[str] = mapped_column(String(20))
    fulfillment_store_id: Mapped[int] = mapped_column(ForeignKey("stores.id"))
    delivery_address: Mapped[dict | None] = mapped_column(JSONB)
    status: Mapped[str] = mapped_column(String(20), server_default=OrderStatus.PLACED.value)
    # Amounts are a financial snapshot at purchase time, so they are stored rather than recomputed.
    subtotal: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    shipping_fee: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    total: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    payment_status: Mapped[str] = mapped_column(String(20), server_default="SIMULATED_PAID")
    client_request_id: Mapped[uuid.UUID | None] = mapped_column(Uuid, unique=True)  # makes checkout retries safe
    placed_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer = relationship("User")
    fulfillment_store = relationship("Store")
    items: Mapped[list["OrderItem"]] = relationship(back_populates="order", cascade="all, delete-orphan")


class OrderItem(Base):
    __tablename__ = "order_items"
    __table_args__ = (
        UniqueConstraint("order_id", "product_id", name="uq_order_items_order_product"),
        CheckConstraint("quantity > 0", name="quantity_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    order_id: Mapped[int] = mapped_column(ForeignKey("orders.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[int]
    unit_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))  # price at purchase time

    order: Mapped[Order] = relationship(back_populates="items")
    product = relationship("Product")
