from datetime import datetime
from uuid import UUID

from pydantic import Field

from app.models.enums import Availability, FulfillmentType
from app.schemas.catalog import StoreOut
from app.schemas.common import CamelModel


class CartItemIn(CamelModel):
    product_id: str = Field(min_length=2, max_length=20)
    quantity: int = Field(ge=1, le=10)


class Address(CamelModel):
    line1: str = Field(min_length=3, max_length=200)
    city: str = Field(min_length=2, max_length=80)
    postal_code: str = Field(min_length=3, max_length=12)


class QuoteRequest(CamelModel):
    fulfillment_type: FulfillmentType
    store_id: int | None = None  # required for pickup
    items: list[CartItemIn] = Field(min_length=1, max_length=20)


class QuoteLine(CamelModel):
    product_id: str
    name: str
    brand: str
    unit_price: float
    quantity: int
    line_total: float
    available_quantity: int
    availability: Availability
    ok: bool
    message: str | None = None


class QuoteResponse(CamelModel):
    fulfillment_type: FulfillmentType
    fulfillment_store: StoreOut
    lines: list[QuoteLine]
    subtotal: float
    shipping_fee: float
    total: float
    can_checkout: bool
    warnings: list[str]


class PlaceOrderRequest(QuoteRequest):
    client_request_id: UUID
    delivery_address: Address | None = None


class OrderItemOut(CamelModel):
    product_id: str
    name: str
    quantity: int
    unit_price: float
    line_total: float


class OrderOut(CamelModel):
    order_number: str
    status: str
    fulfillment_type: str
    fulfillment_store: StoreOut
    delivery_address: Address | None
    items: list[OrderItemOut]
    subtotal: float
    shipping_fee: float
    total: float
    payment_status: str
    placed_at: datetime
    updated_at: datetime
    customer_name: str


class OrderSummary(CamelModel):
    order_number: str
    status: str
    fulfillment_type: str
    store_name: str
    item_count: int
    total: float
    placed_at: datetime
    customer_name: str
