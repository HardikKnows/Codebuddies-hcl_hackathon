from decimal import Decimal

from sqlalchemy import func, select, text, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload, selectinload

from app.core.errors import AppError, bad_request, conflict, not_found
from app.core.permissions import can_view_order
from app.models import Inventory, Order, OrderItem, Product, Store, User
from app.models.enums import AuditOutcome, FulfillmentType, StoreType
from app.schemas.catalog import StoreOut
from app.schemas.orders import (
    Address,
    OrderItemOut,
    OrderOut,
    OrderSummary,
    PlaceOrderRequest,
    QuoteLine,
    QuoteRequest,
    QuoteResponse,
)
from app.services import audit
from app.services.inventory import availability_status

DELIVERY_FEE = Decimal("149.00")
FREE_DELIVERY_THRESHOLD = Decimal("5000")


def shipping_fee(fulfillment_type: str, subtotal: Decimal) -> Decimal:
    if fulfillment_type == FulfillmentType.PICKUP or subtotal >= FREE_DELIVERY_THRESHOLD:
        return Decimal("0")
    return DELIVERY_FEE


def resolve_fulfillment_store(db: Session, fulfillment_type: str, store_id: int | None) -> Store:
    """Pickup happens at the chosen store; home delivery ships from the central warehouse."""
    if fulfillment_type == FulfillmentType.PICKUP:
        if store_id is None:
            raise bad_request("STORE_REQUIRED", "Choose a store for in-store pickup.")
        store = db.get(Store, store_id)
        if store is None or store.type != StoreType.STORE:
            raise bad_request("INVALID_STORE", "Pickup is only available at NovaMart stores.")
        return store
    warehouse = db.scalar(select(Store).where(Store.type == StoreType.WAREHOUSE).order_by(Store.id))
    if warehouse is None:
        raise AppError(503, "DELIVERY_UNAVAILABLE", "Home delivery is temporarily unavailable.")
    return warehouse


def _merge(items) -> dict[str, int]:
    merged: dict[str, int] = {}
    for item in items:
        sku = item.product_id.strip().upper()
        merged[sku] = merged.get(sku, 0) + item.quantity
    return merged


def _load_products(db: Session, skus: list[str]) -> dict[str, Product]:
    products = db.scalars(
        select(Product).options(joinedload(Product.brand)).where(Product.sku.in_(skus), Product.is_active.is_(True))
    ).all()
    return {p.sku: p for p in products}


def quote(db: Session, req: QuoteRequest) -> QuoteResponse:
    store = resolve_fulfillment_store(db, req.fulfillment_type, req.store_id)
    wanted = _merge(req.items)
    products = _load_products(db, list(wanted))
    stock = {
        row.product_id: row
        for row in db.scalars(
            select(Inventory).where(
                Inventory.store_id == store.id, Inventory.product_id.in_([p.id for p in products.values()])
            )
        )
    }
    lines: list[QuoteLine] = []
    warnings: list[str] = []
    subtotal = Decimal("0")
    for sku, qty in wanted.items():
        product = products.get(sku)
        if product is None:
            warnings.append(f"{sku} is no longer available and was skipped.")
            continue
        row = stock.get(product.id)
        available = row.quantity if row else 0
        ok = available >= qty
        message = None
        if not ok:
            message = f"Only {available} left at {store.name}." if available else f"Out of stock at {store.name}."
            warnings.append(f"{product.name}: {message}")
        subtotal += product.price * qty
        lines.append(
            QuoteLine(
                product_id=sku, name=product.name, brand=product.brand.name, unit_price=float(product.price),
                quantity=qty, line_total=float(product.price * qty), available_quantity=available,
                availability=availability_status(available, row.reorder_level if row else 0), ok=ok, message=message,
            )
        )
    fee = shipping_fee(req.fulfillment_type, subtotal)
    return QuoteResponse(
        fulfillment_type=req.fulfillment_type,
        fulfillment_store=StoreOut.model_validate(store),
        lines=lines,
        subtotal=float(subtotal),
        shipping_fee=float(fee),
        total=float(subtotal + fee),
        can_checkout=bool(lines) and all(line.ok for line in lines) and len(lines) == len(wanted),
        warnings=warnings,
    )


def place_order(db: Session, user: User, req: PlaceOrderRequest, request_id: str | None) -> OrderOut:
    existing = db.scalar(select(Order).where(Order.client_request_id == req.client_request_id))
    if existing is not None:  # a retried checkout returns the order it already created
        if existing.customer_id != user.id:
            raise conflict("DUPLICATE_REQUEST", "This checkout request was already used.")
        return get_order_out(db, user, existing.order_number)

    try:
        if req.fulfillment_type == FulfillmentType.DELIVERY and req.delivery_address is None:
            raise bad_request("ADDRESS_REQUIRED", "Add a delivery address for home delivery.")
        store = resolve_fulfillment_store(db, req.fulfillment_type, req.store_id)
        wanted = _merge(req.items)
        products = _load_products(db, list(wanted))
        missing = [sku for sku in wanted if sku not in products]
        if missing:
            raise bad_request("UNKNOWN_PRODUCT", f"Unavailable product(s): {', '.join(missing)}.", product_ids=missing)

        # Conditional decrement: the stock check and the update are one atomic statement, so we never oversell.
        for sku, qty in wanted.items():
            result = db.execute(
                update(Inventory)
                .where(
                    Inventory.store_id == store.id,
                    Inventory.product_id == products[sku].id,
                    Inventory.quantity >= qty,
                )
                .values(quantity=Inventory.quantity - qty, updated_at=func.now())
            )
            if result.rowcount == 0:
                available = db.scalar(
                    select(Inventory.quantity).where(
                        Inventory.store_id == store.id, Inventory.product_id == products[sku].id
                    )
                ) or 0
                raise conflict(
                    "INSUFFICIENT_STOCK",
                    f"Only {available} × {products[sku].name} left at {store.name}.",
                    product_id=sku, available=available, store_id=store.id,
                )

        subtotal = sum((products[sku].price * qty for sku, qty in wanted.items()), Decimal("0"))
        fee = shipping_fee(req.fulfillment_type, subtotal)
        number = db.scalar(text("SELECT nextval('order_number_seq')"))
        order = Order(
            order_number=f"NM-{number}",
            customer_id=user.id,
            fulfillment_type=req.fulfillment_type,
            fulfillment_store_id=store.id,
            delivery_address=req.delivery_address.model_dump() if req.delivery_address else None,
            subtotal=subtotal,
            shipping_fee=fee,
            total=subtotal + fee,
            client_request_id=req.client_request_id,
            items=[
                OrderItem(product_id=products[sku].id, quantity=qty, unit_price=products[sku].price)
                for sku, qty in wanted.items()
            ],
        )
        db.add(order)
        db.commit()
    except AppError as exc:
        db.rollback()
        audit.record(action="order.place", outcome=AuditOutcome.FAILED, actor=user, request_id=request_id,
                     details={"code": exc.code, "message": exc.message, **exc.details})
        raise
    except IntegrityError:  # two concurrent submits of the same checkout
        db.rollback()
        existing = db.scalar(select(Order).where(Order.client_request_id == req.client_request_id))
        if existing is None or existing.customer_id != user.id:
            raise
        return get_order_out(db, user, existing.order_number)

    audit.record(
        action="order.place", outcome=AuditOutcome.SUCCESS, actor=user, entity_type="order",
        entity_id=order.order_number, request_id=request_id,
        details={
            "total": float(order.total), "fulfillmentType": req.fulfillment_type, "store": store.code,
            "items": [{"productId": sku, "quantity": qty} for sku, qty in wanted.items()],
        },
    )
    return get_order_out(db, user, order.order_number)


def _load_order(db: Session, order_number: str) -> Order | None:
    return db.scalar(
        select(Order)
        .options(
            joinedload(Order.customer),
            joinedload(Order.fulfillment_store),
            selectinload(Order.items).joinedload(OrderItem.product),
        )
        .where(Order.order_number == order_number.strip().upper())
    )


def find_viewable_order(db: Session, user: User, order_number: str) -> Order | None:
    """The order if it exists and this user may see it; otherwise None (callers don't reveal which)."""
    order = _load_order(db, order_number)
    return order if order is not None and can_view_order(user, order) else None


def order_to_out(order: Order) -> OrderOut:
    return OrderOut(
        order_number=order.order_number,
        status=order.status,
        fulfillment_type=order.fulfillment_type,
        fulfillment_store=StoreOut.model_validate(order.fulfillment_store),
        delivery_address=Address.model_validate(order.delivery_address) if order.delivery_address else None,
        items=[
            OrderItemOut(
                product_id=item.product.sku, name=item.product.name, quantity=item.quantity,
                unit_price=float(item.unit_price), line_total=float(item.unit_price * item.quantity),
            )
            for item in order.items
        ],
        subtotal=float(order.subtotal),
        shipping_fee=float(order.shipping_fee),
        total=float(order.total),
        payment_status=order.payment_status,
        placed_at=order.placed_at,
        updated_at=order.updated_at,
        customer_name=order.customer.full_name,
    )


def get_order_out(db: Session, user: User, order_number: str, request_id: str | None = None) -> OrderOut:
    order = _load_order(db, order_number)
    if order is None or not can_view_order(user, order):
        if order is not None:
            audit.record(action="order.view", outcome=AuditOutcome.DENIED, actor=user, entity_type="order",
                         entity_id=order.order_number, request_id=request_id,
                         details={"reason": "Order belongs to another customer"})
        raise not_found(f"Order {order_number.upper()} was not found.", order_number=order_number)
    return order_to_out(order)


def _summary(order: Order) -> OrderSummary:
    return OrderSummary(
        order_number=order.order_number,
        status=order.status,
        fulfillment_type=order.fulfillment_type,
        store_name=order.fulfillment_store.name,
        item_count=sum(item.quantity for item in order.items),
        total=float(order.total),
        placed_at=order.placed_at,
        customer_name=order.customer.full_name,
    )


def list_orders(
    db: Session,
    *,
    customer_id: int | None,
    q: str | None = None,
    status: str | None = None,
    page: int,
    page_size: int,
) -> tuple[list[OrderSummary], int]:
    stmt = select(Order)
    if customer_id is not None:
        stmt = stmt.where(Order.customer_id == customer_id)
    if q:
        stmt = stmt.where(Order.order_number.ilike(f"%{q.strip()}%"))
    if status:
        stmt = stmt.where(Order.status == status)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    orders = db.scalars(
        stmt.options(joinedload(Order.customer), joinedload(Order.fulfillment_store), selectinload(Order.items))
        .order_by(Order.placed_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [_summary(o) for o in orders], total
