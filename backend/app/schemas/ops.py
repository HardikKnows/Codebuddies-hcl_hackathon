from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator

from app.models.enums import Availability
from app.schemas.common import CamelModel

MAX_STOCK_ADJUSTMENT = 10_000


class AuditEventOut(CamelModel):
    id: int
    occurred_at: datetime
    actor_name: str | None
    actor_role: str | None
    action: str
    source: str
    outcome: str
    entity_type: str | None
    entity_id: str | None
    request_id: str | None
    details: dict


class InventoryRow(CamelModel):
    store_id: int
    store_code: str
    store_name: str
    product_id: str
    product_name: str
    brand: str
    category: str
    category_slug: str
    price: float
    image_url: str | None
    quantity: int
    reorder_level: int
    status: Availability
    updated_at: datetime


class StoreStockSummary(CamelModel):
    store_id: int
    store_code: str
    store_name: str
    type: str
    low_stock: int
    out_of_stock: int
    total_units: int


class OpsSummary(CamelModel):
    low_stock_count: int
    out_of_stock_count: int
    open_tickets: int
    escalated_tickets: int
    orders_today: int
    revenue_today: float
    stores: list[StoreStockSummary]
    low_stock_items: list[InventoryRow]
    recent_activity: list[AuditEventOut]


class SimulateEventRequest(CamelModel):
    store_id: int
    kind: Literal["DEMAND_SPIKE", "RESTOCK"]
    product_id: str | None = None


class StockChange(CamelModel):
    product_id: str
    product_name: str
    before: int
    after: int
    status: Availability


class SimulateEventResult(CamelModel):
    kind: str
    store_name: str
    changes: list[StockChange]


class StockAdjustmentRequest(CamelModel):
    product_id: str = Field(min_length=2, max_length=20)
    # Admins choose a store; a store manager always acts on their assigned store (taken from the session).
    store_id: int | None = None
    # Strict: JSON 20 is accepted, "20" and 20.5 are not. Positive adds units, negative removes them.
    delta: int = Field(strict=True, ge=-MAX_STOCK_ADJUSTMENT, le=MAX_STOCK_ADJUSTMENT)
    reason: str | None = Field(default=None, max_length=200)

    @field_validator("delta")
    @classmethod
    def _non_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("must not be zero")
        return value


class StockAdjustmentResult(CamelModel):
    row: InventoryRow  # the updated row, read back from the database
    previous_quantity: int
    delta: int
    reason: str | None
