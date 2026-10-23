import random
from collections import defaultdict

from sqlalchemy import case, func, select, update
from sqlalchemy.orm import Session, joinedload

from app.core.errors import AppError, bad_request, conflict, forbidden, not_found
from app.core.permissions import Permission, can_manage_store, has_permission
from app.models import Brand, Category, Inventory, Product, Store, User
from app.models.enums import AuditOutcome, Availability
from app.schemas.ops import (
    MAX_STOCK_ADJUSTMENT,
    InventoryRow,
    SimulateEventResult,
    StockAdjustmentResult,
    StockChange,
    StoreStockSummary,
)
from app.services import audit

# One definition of availability, shared by the catalog, the AI and the operations dashboard.
STATUS_EXPR = case(
    (Inventory.quantity <= 0, Availability.OUT_OF_STOCK.value),
    (Inventory.quantity <= Inventory.reorder_level, Availability.LOW_STOCK.value),
    else_=Availability.IN_STOCK.value,
)
_URGENCY = case(
    (Inventory.quantity <= 0, 0),
    (Inventory.quantity <= Inventory.reorder_level, 1),
    else_=2,
)


def availability_status(quantity: int, reorder_level: int) -> Availability:
    if quantity <= 0:
        return Availability.OUT_OF_STOCK
    if quantity <= reorder_level:
        return Availability.LOW_STOCK
    return Availability.IN_STOCK


def overall_status(rows: list[Inventory]) -> tuple[Availability, int]:
    total = sum(r.quantity for r in rows)
    if total == 0:
        return Availability.OUT_OF_STOCK, 0
    if any(r.quantity > r.reorder_level for r in rows):
        return Availability.IN_STOCK, total
    return Availability.LOW_STOCK, total


def status_for(rows: list[Inventory], store_id: int | None) -> tuple[Availability, int]:
    """Availability at one store when a store is selected, otherwise across all locations."""
    if store_id is None:
        return overall_status(rows)
    row = next((r for r in rows if r.store_id == store_id), None)
    return (availability_status(row.quantity, row.reorder_level), row.quantity) if row else (Availability.OUT_OF_STOCK, 0)


def stock_by_product(db: Session, product_ids: list[int]) -> dict[int, list[Inventory]]:
    grouped: dict[int, list[Inventory]] = defaultdict(list)
    if product_ids:
        for row in db.scalars(
            select(Inventory).options(joinedload(Inventory.store)).where(Inventory.product_id.in_(product_ids))
        ):
            grouped[row.product_id].append(row)
    return grouped


def _rows_select():
    """Inventory rows joined with everything an InventoryRow displays."""
    return (
        select(Inventory, Product, Brand, Category, Store)
        .join(Product, Product.id == Inventory.product_id)
        .join(Brand, Brand.id == Product.brand_id)
        .join(Category, Category.id == Product.category_id)
        .join(Store, Store.id == Inventory.store_id)
    )


def _row_out(inv: Inventory, product: Product, brand: Brand, category: Category, store: Store) -> InventoryRow:
    return InventoryRow(
        store_id=store.id,
        store_code=store.code,
        store_name=store.name,
        product_id=product.sku,
        product_name=product.name,
        brand=brand.name,
        category=category.name,
        category_slug=category.slug,
        price=float(product.price),
        image_url=product.image_url,
        quantity=inv.quantity,
        reorder_level=inv.reorder_level,
        status=availability_status(inv.quantity, inv.reorder_level),
        updated_at=inv.updated_at,
    )


def list_inventory(
    db: Session,
    *,
    store_id: int | None,
    status: Availability | None,
    q: str | None,
    page: int,
    page_size: int,
) -> tuple[list[InventoryRow], int]:
    stmt = _filtered_select(store_id=store_id, status=status, q=q)
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    rows = db.execute(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return [_row_out(*row) for row in rows], total


def _filtered_select(*, store_id: int | None, status: Availability | None, q: str | None):
    """The inventory dashboard's filters and order, shared by the table and the CSV export."""
    stmt = _rows_select()
    if store_id:
        stmt = stmt.where(Inventory.store_id == store_id)
    if status:
        stmt = stmt.where(STATUS_EXPR == status.value)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(Product.name.ilike(like) | Product.sku.ilike(like) | Brand.name.ilike(like))
    return stmt.order_by(_URGENCY, Inventory.quantity, Product.name, Store.code)


def filtered_rows(
    db: Session, *, store_id: int | None, status: Availability | None, q: str | None, limit: int
) -> list[InventoryRow]:
    return [_row_out(*row) for row in db.execute(_filtered_select(store_id=store_id, status=status, q=q).limit(limit)).all()]


def low_stock_items(db: Session, *, store_id: int | None = None, limit: int = 10) -> list[InventoryRow]:
    stmt = _rows_select().where(Inventory.quantity <= Inventory.reorder_level)
    if store_id:
        stmt = stmt.where(Inventory.store_id == store_id)
    rows = db.execute(stmt.order_by(_URGENCY, Inventory.updated_at.desc(), Inventory.quantity).limit(limit)).all()
    return [_row_out(*row) for row in rows]


def store_summaries(db: Session) -> list[StoreStockSummary]:
    low = func.count().filter((Inventory.quantity > 0) & (Inventory.quantity <= Inventory.reorder_level))
    out = func.count().filter(Inventory.quantity <= 0)
    rows = db.execute(
        select(Store, low, out, func.coalesce(func.sum(Inventory.quantity), 0))
        .join(Inventory, Inventory.store_id == Store.id)
        .group_by(Store.id)
        .order_by(Store.type, Store.name)
    ).all()
    return [
        StoreStockSummary(
            store_id=s.id, store_code=s.code, store_name=s.name, type=s.type,
            low_stock=low_n, out_of_stock=out_n, total_units=units,
        )
        for s, low_n, out_n, units in rows
    ]


def simulate_event(
    db: Session, *, user: User, store_id: int, kind: str, sku: str | None, request_id: str | None
) -> SimulateEventResult:
    """Simulates the periodic stock feed: a demand spike drains stock, a restock refills low items."""
    store = db.get(Store, store_id)
    if store is None:
        raise not_found("Store not found.", store_id=store_id)
    if not can_manage_store(user, store_id):
        audit.record(action=f"inventory.{kind.lower()}", outcome="DENIED", actor=user, entity_type="store",
                     entity_id=store.code, request_id=request_id, details={"reason": "Not this user's store"})
        raise forbidden("Store managers can only simulate events for their own store.")

    stmt = select(Inventory).options(joinedload(Inventory.product)).where(Inventory.store_id == store_id)
    if sku:
        stmt = stmt.join(Product).where(Product.sku == sku.upper())
    rows = list(db.scalars(stmt))
    if sku and not rows:
        raise bad_request("UNKNOWN_PRODUCT", f"Product {sku} is not stocked at {store.name}.")

    rng = random.Random()
    changes: list[tuple[Inventory, int]] = []
    if kind == "DEMAND_SPIKE":
        candidates = [r for r in rows if r.quantity > r.reorder_level]
        targets = candidates if sku else rng.sample(candidates, k=min(3, len(candidates)))
        for row in targets:
            before = row.quantity
            row.quantity = max(0, min(row.reorder_level - 1, before - max(1, int(before * rng.uniform(0.6, 0.9)))))
            changes.append((row, before))
    else:
        targets = rows if sku else [r for r in rows if r.quantity <= r.reorder_level]
        for row in targets:
            before = row.quantity
            row.quantity = max(before, row.reorder_level * 4)
            changes.append((row, before))
    db.commit()

    result = SimulateEventResult(
        kind=kind,
        store_name=store.name,
        changes=[
            StockChange(product_id=r.product.sku, product_name=r.product.name, before=before, after=r.quantity,
                        status=availability_status(r.quantity, r.reorder_level))
            for r, before in changes
        ],
    )
    audit.record(
        action=f"inventory.{kind.lower()}", outcome="SUCCESS", actor=user, entity_type="store", entity_id=store.code,
        request_id=request_id,
        details={"changes": [c.model_dump(by_alias=True) for c in result.changes], "simulated": True},
    )
    return result


def authorize_adjustment(db: Session, user: User, *, sku: str, store_id: int | None) -> tuple[Store, Product]:
    """Decide from the session user, never from the client, whose stock may change.

    A store manager always acts on their assigned store (a different store id is refused); admins name a store.
    """
    if not has_permission(user.role, Permission.INVENTORY_ADJUST):
        raise forbidden("Only store managers can adjust stock.")
    target = store_id if store_id is not None else user.store_id
    if target is None:
        raise bad_request("STORE_REQUIRED", "Choose the store whose stock you want to adjust.")
    if not can_manage_store(user, target):
        raise forbidden("Store managers can only adjust stock at their assigned store.", store_id=target)
    store = db.get(Store, target)
    if store is None:
        raise not_found("Store not found.", store_id=target)
    product = db.scalar(select(Product).where(Product.sku == sku.strip().upper()))
    if product is None:
        raise not_found(f"Product {sku.strip().upper()} was not found.", product_id=sku)
    return store, product


def apply_adjustment(db: Session, *, store: Store, product: Product, delta: int) -> tuple[int, int]:
    """Change stock in one conditional UPDATE, so concurrent changes can never take it below zero.

    Returns (previous, new) quantities as read from the database. The caller commits.
    """
    if delta == 0 or abs(delta) > MAX_STOCK_ADJUSTMENT:
        raise bad_request("INVALID_QUANTITY", f"Adjust by a non-zero whole number of at most {MAX_STOCK_ADJUSTMENT} units.")
    new_quantity = db.scalar(
        update(Inventory)
        .where(
            Inventory.store_id == store.id,
            Inventory.product_id == product.id,
            Inventory.quantity + delta >= 0,
        )
        .values(quantity=Inventory.quantity + delta, updated_at=func.now())
        .returning(Inventory.quantity)
        .execution_options(synchronize_session=False)
    )
    if new_quantity is None:
        current = db.scalar(
            select(Inventory.quantity).where(Inventory.store_id == store.id, Inventory.product_id == product.id)
        )
        if current is None:
            raise not_found(f"{product.name} is not stocked at {store.name}.", product_id=product.sku)
        raise conflict(
            "NEGATIVE_STOCK",
            f"Only {current} units of {product.name} are in stock at {store.name}; removing {-delta} would make stock negative.",
            current_quantity=current,
        )
    return new_quantity - delta, new_quantity


def inventory_row(db: Session, *, store_id: int, product_id: int) -> InventoryRow:
    row = db.execute(
        _rows_select()
        .where(Inventory.store_id == store_id, Inventory.product_id == product_id)
        .execution_options(populate_existing=True)
    ).one()
    return _row_out(*row)


def adjust_stock(
    db: Session,
    *,
    user: User,
    sku: str,
    delta: int,
    reason: str | None,
    store_id: int | None,
    request_id: str | None,
) -> StockAdjustmentResult:
    """An individual stock change from the operations dashboard, audited whether it succeeds or not."""
    reason = (reason or "").strip() or None
    details = {"productId": sku.strip().upper(), "requestedStoreId": store_id, "delta": delta, "reason": reason}
    try:
        store, product = authorize_adjustment(db, user, sku=sku, store_id=store_id)
        details.update(storeId=store.id, storeCode=store.code, productName=product.name)
        previous, new = apply_adjustment(db, store=store, product=product, delta=delta)
        db.commit()
    except AppError as exc:
        db.rollback()
        audit.record(
            action="inventory.adjust",
            outcome=AuditOutcome.DENIED if exc.status_code == 403 else AuditOutcome.FAILED,
            actor=user, entity_type="inventory",
            entity_id=f"{details.get('storeCode', store_id or user.store_id)}/{details['productId']}",
            request_id=request_id, details={**details, "code": exc.code, "message": exc.message},
        )
        raise
    audit.record(
        action="inventory.adjust", outcome=AuditOutcome.SUCCESS, actor=user, entity_type="inventory",
        entity_id=f"{store.code}/{product.sku}", request_id=request_id,
        details={**details, "previousQuantity": previous, "newQuantity": new},
    )
    return StockAdjustmentResult(
        row=inventory_row(db, store_id=store.id, product_id=product.id),
        previous_quantity=previous,
        delta=delta,
        reason=reason,
    )
