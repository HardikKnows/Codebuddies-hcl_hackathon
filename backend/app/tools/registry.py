"""The only operations the language model can request. There is no generic query or mutation tool."""

from dataclasses import dataclass
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import TicketCategory, TicketPriority
from app.schemas.ops import MAX_STOCK_ADJUSTMENT
from app.schemas.tickets import ORDER_NUMBER_PATTERN, normalize_order_number

SKU_PATTERN = r"^P\d{3}$"


class OrderLookupArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_number: str = Field(pattern=ORDER_NUMBER_PATTERN)

    _normalize = field_validator("order_number", mode="before")(normalize_order_number)


class TicketProposalArgs(BaseModel):
    model_config = ConfigDict(extra="forbid")

    order_number: str | None = Field(pattern=ORDER_NUMBER_PATTERN)
    category: TicketCategory
    priority: TicketPriority
    subject: str = Field(min_length=5, max_length=120)
    description: str = Field(min_length=10, max_length=1000)

    _normalize = field_validator("order_number", mode="before")(normalize_order_number)


class StockAdjustmentArgs(BaseModel):
    """No store field: the store always comes from the signed-in manager's session."""

    model_config = ConfigDict(extra="forbid")

    product_id: str = Field(pattern=SKU_PATTERN)
    delta: int = Field(strict=True, ge=-MAX_STOCK_ADJUSTMENT, le=MAX_STOCK_ADJUSTMENT)
    reason: str | None = Field(max_length=200)

    _normalize = field_validator("product_id", mode="before")(lambda v: v.strip().upper() if isinstance(v, str) else v)

    @field_validator("delta")
    @classmethod
    def _non_zero(cls, value: int) -> int:
        if value == 0:
            raise ValueError("must not be zero")
        return value


@dataclass(frozen=True)
class ToolSpec:
    name: str
    description: str
    parameters: dict  # strict JSON schema shown to the model; the args model re-validates server-side
    args_model: type[BaseModel]
    effect: Literal["READ", "PROPOSE"]


TOOLS: dict[str, ToolSpec] = {
    "get_order_status": ToolSpec(
        name="get_order_status",
        description="Look up a NovaMart order the signed-in customer owns (staff may look up any order). "
        "Returns status, fulfillment details and items.",
        parameters={
            "type": "object",
            "properties": {"order_number": {"type": "string", "description": "Order number in the format NM-123456."}},
            "required": ["order_number"],
            "additionalProperties": False,
        },
        args_model=OrderLookupArgs,
        effect="READ",
    ),
    "propose_support_ticket": ToolSpec(
        name="propose_support_ticket",
        description="Propose a customer support ticket. This does NOT create the ticket: the customer must review "
        "and press Confirm in the app first.",
        parameters={
            "type": "object",
            "properties": {
                "order_number": {"type": ["string", "null"], "description": "Related order number (NM-123456) or null."},
                "category": {"type": "string", "enum": [c.value for c in TicketCategory]},
                "priority": {"type": "string", "enum": [p.value for p in TicketPriority]},
                "subject": {"type": "string", "description": "Short summary, 5-120 characters."},
                "description": {"type": "string", "description": "What happened, 10-1000 characters."},
            },
            "required": ["order_number", "category", "priority", "subject", "description"],
            "additionalProperties": False,
        },
        args_model=TicketProposalArgs,
        effect="PROPOSE",
    ),
    "propose_stock_adjustment": ToolSpec(
        name="propose_stock_adjustment",
        description="Propose changing the stock of one product at the signed-in store manager's own store. A positive "
        "delta adds units, a negative delta removes them. This does NOT change stock: the manager must review the "
        "change and press Confirm in the app first.",
        parameters={
            "type": "object",
            "properties": {
                "product_id": {"type": "string", "description": "Product id such as P101."},
                "delta": {"type": "integer", "description": "Units to add (positive) or remove (negative); never zero."},
                "reason": {"type": ["string", "null"], "description": "Short reason given by the manager, or null."},
            },
            "required": ["product_id", "delta", "reason"],
            "additionalProperties": False,
        },
        args_model=StockAdjustmentArgs,
        effect="PROPOSE",
    ),
}


def openai_tools(names: list[str]) -> list[dict]:
    return [
        {
            "type": "function",
            "name": TOOLS[name].name,
            "description": TOOLS[name].description,
            "parameters": TOOLS[name].parameters,
            "strict": True,
        }
        for name in names
    ]
