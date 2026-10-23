from enum import StrEnum

from sqlalchemy import CheckConstraint


class Role(StrEnum):
    CUSTOMER = "CUSTOMER"
    STORE_STAFF = "STORE_STAFF"
    STORE_MANAGER = "STORE_MANAGER"
    ADMIN = "ADMIN"


class MembershipTier(StrEnum):
    STANDARD = "STANDARD"
    SILVER = "SILVER"
    GOLD = "GOLD"
    PLATINUM = "PLATINUM"


class StoreType(StrEnum):
    STORE = "STORE"
    WAREHOUSE = "WAREHOUSE"


class Availability(StrEnum):
    IN_STOCK = "IN_STOCK"
    LOW_STOCK = "LOW_STOCK"
    OUT_OF_STOCK = "OUT_OF_STOCK"


class FulfillmentType(StrEnum):
    PICKUP = "PICKUP"
    DELIVERY = "DELIVERY"


class OrderStatus(StrEnum):
    PLACED = "PLACED"
    PACKED = "PACKED"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    SHIPPED = "SHIPPED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    PICKED_UP = "PICKED_UP"
    CANCELLED = "CANCELLED"


class TicketCategory(StrEnum):
    DAMAGED_ITEM = "DAMAGED_ITEM"
    RETURN = "RETURN"
    REFUND = "REFUND"
    WARRANTY = "WARRANTY"
    DELIVERY = "DELIVERY"
    PRODUCT_QUERY = "PRODUCT_QUERY"
    OTHER = "OTHER"


class TicketPriority(StrEnum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    URGENT = "URGENT"


class TicketStatus(StrEnum):
    OPEN = "OPEN"
    IN_PROGRESS = "IN_PROGRESS"
    ESCALATED = "ESCALATED"
    RESOLVED = "RESOLVED"
    CLOSED = "CLOSED"


class TicketSource(StrEnum):
    WEB = "WEB"
    AI_ASSISTANT = "AI_ASSISTANT"
    STAFF = "STAFF"


class DocType(StrEnum):
    RETURN_POLICY = "RETURN_POLICY"
    WARRANTY_POLICY = "WARRANTY_POLICY"
    SHIPPING_POLICY = "SHIPPING_POLICY"
    MEMBERSHIP_BENEFITS = "MEMBERSHIP_BENEFITS"
    PROMOTION = "PROMOTION"
    PRODUCT_MANUAL = "PRODUCT_MANUAL"
    STORE_PROCEDURE = "STORE_PROCEDURE"


class DocStatus(StrEnum):
    ACTIVE = "ACTIVE"
    ARCHIVED = "ARCHIVED"


class SourceFormat(StrEnum):
    MARKDOWN = "MARKDOWN"
    TEXT = "TEXT"
    CSV = "CSV"
    JSON = "JSON"
    PDF = "PDF"


class AuditSource(StrEnum):
    UI = "UI"
    AI_ASSISTANT = "AI_ASSISTANT"
    SYSTEM = "SYSTEM"


class AuditOutcome(StrEnum):
    SUCCESS = "SUCCESS"
    DENIED = "DENIED"
    FAILED = "FAILED"
    PROPOSED = "PROPOSED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"


class ActionStatus(StrEnum):
    PENDING = "PENDING"
    EXECUTED = "EXECUTED"
    CANCELLED = "CANCELLED"
    EXPIRED = "EXPIRED"
    FAILED = "FAILED"


def check_in(column: str, enum: type[StrEnum]) -> CheckConstraint:
    """CHECK constraint limiting a text column to an enum's values (easier to evolve than native enums)."""
    values = ", ".join(f"'{member.value}'" for member in enum)
    return CheckConstraint(f"{column} IN ({values})", name=f"{column}_valid")
