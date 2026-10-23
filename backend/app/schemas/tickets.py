from datetime import datetime

from pydantic import Field, field_validator

from app.models.enums import TicketCategory, TicketPriority, TicketStatus
from app.schemas.common import CamelModel

ORDER_NUMBER_PATTERN = r"^NM-\d{6}$"


def normalize_order_number(value: str | None) -> str | None:
    return value.strip().upper() if isinstance(value, str) and value.strip() else None


class TicketCreate(CamelModel):
    order_number: str | None = Field(default=None, pattern=ORDER_NUMBER_PATTERN)
    category: TicketCategory
    priority: TicketPriority = TicketPriority.MEDIUM
    subject: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=10, max_length=2000)

    _normalize = field_validator("order_number", mode="before")(normalize_order_number)


class TicketUpdate(CamelModel):
    status: TicketStatus | None = None
    priority: TicketPriority | None = None
    assign_to_me: bool = False


class TicketOut(CamelModel):
    ticket_number: str
    status: str
    priority: str
    category: str
    subject: str
    description: str
    source: str
    order_number: str | None
    customer_name: str
    created_by_name: str
    assigned_to_name: str | None
    created_at: datetime
    updated_at: datetime
