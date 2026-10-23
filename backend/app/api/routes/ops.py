from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import Ctx, Pagination, pagination, require_permission
from app.core.permissions import Permission, has_permission
from app.db.session import get_db
from app.models import AuditEvent, Inventory, Order, SupportTicket
from app.models.enums import Availability, AuditOutcome, AuditSource, OrderStatus, TicketStatus
from app.schemas.common import Page
from app.schemas.ops import (
    AuditEventOut,
    InventoryRow,
    OpsSummary,
    SimulateEventRequest,
    SimulateEventResult,
    StockAdjustmentRequest,
    StockAdjustmentResult,
)
from app.schemas.orders import OrderSummary
from app.services import audit, inventory, orders

router = APIRouter(tags=["operations"])


@router.get("/ops/summary", response_model=OpsSummary)
def summary(ctx: Ctx = Depends(require_permission(Permission.INVENTORY_VIEW)), db: Session = Depends(get_db)):
    low = db.scalar(
        select(func.count()).where(Inventory.quantity > 0, Inventory.quantity <= Inventory.reorder_level)
    )
    out = db.scalar(select(func.count()).where(Inventory.quantity <= 0))
    open_statuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.ESCALATED]
    open_tickets = db.scalar(select(func.count()).where(SupportTicket.status.in_(open_statuses)))
    escalated = db.scalar(select(func.count()).where(SupportTicket.status == TicketStatus.ESCALATED))
    today = func.date_trunc("day", func.now())
    orders_today, revenue_today = db.execute(
        select(func.count(), func.coalesce(func.sum(Order.total), 0)).where(
            Order.placed_at >= today, Order.status != OrderStatus.CANCELLED
        )
    ).one()
    recent = []
    if has_permission(ctx.user.role, Permission.AUDIT_VIEW):
        recent = [
            audit.to_out(e)
            for e in db.scalars(
                select(AuditEvent).options(joinedload(AuditEvent.actor))
                .order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc()).limit(8)
            )
        ]
    return OpsSummary(
        low_stock_count=low or 0,
        out_of_stock_count=out or 0,
        open_tickets=open_tickets or 0,
        escalated_tickets=escalated or 0,
        orders_today=orders_today,
        revenue_today=float(revenue_today),
        stores=inventory.store_summaries(db),
        low_stock_items=inventory.low_stock_items(db, limit=10),
        recent_activity=recent,
    )


@router.get("/ops/inventory", response_model=Page[InventoryRow])
def list_inventory(
    store_id: int | None = Query(None, alias="storeId"),
    status: Availability | None = None,
    q: str | None = Query(None, max_length=100),
    ctx: Ctx = Depends(require_permission(Permission.INVENTORY_VIEW)),
    pages: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
):
    items, total = inventory.list_inventory(
        db, store_id=store_id, status=status, q=q, page=pages.page, page_size=pages.page_size
    )
    return Page(items=items, page=pages.page, page_size=pages.page_size, total=total)


@router.post("/ops/inventory/simulated-events", response_model=SimulateEventResult)
def simulate_inventory_event(
    body: SimulateEventRequest,
    ctx: Ctx = Depends(require_permission(Permission.INVENTORY_SIMULATE)),
    db: Session = Depends(get_db),
):
    return inventory.simulate_event(
        db, user=ctx.user, store_id=body.store_id, kind=body.kind, sku=body.product_id, request_id=ctx.request_id
    )


@router.post("/ops/inventory/adjustments", response_model=StockAdjustmentResult)
def adjust_inventory(
    body: StockAdjustmentRequest,
    ctx: Ctx = Depends(require_permission(Permission.INVENTORY_ADJUST)),
    db: Session = Depends(get_db),
):
    """Individual stock change. Store scope comes from the session; current stock is read from the database."""
    return inventory.adjust_stock(
        db, user=ctx.user, sku=body.product_id, delta=body.delta, reason=body.reason, store_id=body.store_id,
        request_id=ctx.request_id,
    )


@router.get("/ops/orders", response_model=Page[OrderSummary])
def list_all_orders(
    q: str | None = Query(None, max_length=20),
    status: OrderStatus | None = None,
    ctx: Ctx = Depends(require_permission(Permission.ORDERS_VIEW_ANY)),
    pages: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
):
    items, total = orders.list_orders(
        db, customer_id=None, q=q, status=status, page=pages.page, page_size=pages.page_size
    )
    return Page(items=items, page=pages.page, page_size=pages.page_size, total=total)


@router.get("/audit-events", response_model=Page[AuditEventOut])
def list_audit_events(
    action: str | None = Query(None, max_length=60),
    outcome: AuditOutcome | None = None,
    source: AuditSource | None = None,
    entity_type: str | None = Query(None, alias="entityType", max_length=40),
    entity_id: str | None = Query(None, alias="entityId", max_length=64),
    ctx: Ctx = Depends(require_permission(Permission.AUDIT_VIEW)),
    pages: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
):
    items, total = audit.list_events(
        db, page=pages.page, page_size=pages.page_size, action=action, outcome=outcome, source=source,
        entity_type=entity_type, entity_id=entity_id,
    )
    return Page(items=items, page=pages.page, page_size=pages.page_size, total=total)
