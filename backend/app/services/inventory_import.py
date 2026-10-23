"""Stock-level CSV import: sets quantities per product and store, within the user's store scope, audited per change.

Accepts the inventory export's columns, so an exported file can be edited and re-imported (read-only columns are ignored).
"""

import re
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.core.errors import AppError
from app.core.permissions import can_manage_store
from app.models import Inventory, Product, Store, User
from app.models.enums import AuditOutcome
from app.schemas.imports import ImportReport, ImportRowOut
from app.services import audit
from app.services.csv_files import parse_csv

REQUIRED = {"sku", "store_code", "quantity"}
OPTIONAL = {"reorder_level"}
IGNORED = frozenset({"name", "brand", "category", "price", "image_url", "store_name", "status", "updated_at"})
ALIASES = {"product_id": "sku", "store": "store_code", "qty": "quantity"}
MAX_QUANTITY = 100_000
MAX_REORDER_LEVEL = 10_000
DEFAULT_REORDER_LEVEL = 5
WHOLE_NUMBER = re.compile(r"^\d{1,6}$")


@dataclass
class PlannedRow:
    out: ImportRowOut
    product: Product | None = None
    store: Store | None = None
    quantity: int = 0
    reorder_level: int | None = None


def analyze(db: Session, user: User, text: str) -> list[PlannedRow]:
    _, rows = parse_csv(text, required=REQUIRED, optional=OPTIONAL, ignored=IGNORED, aliases=ALIASES)
    stores = {s.code.upper(): s for s in db.scalars(select(Store))}
    skus = {r.values.get("sku", "").upper() for r in rows if not r.error}
    products = {p.sku: p for p in db.scalars(select(Product).where(Product.sku.in_(skus)))}
    current = {
        (inv.store_id, inv.product_id): inv
        for inv in db.scalars(select(Inventory).where(Inventory.product_id.in_([p.id for p in products.values()])))
    }

    seen: dict[tuple[str, str], int] = {}
    planned: list[PlannedRow] = []
    for r in rows:
        if r.error:
            planned.append(PlannedRow(ImportRowOut(row=r.number, sku=None, action="reject", errors=[r.error])))
            continue
        errors: list[str] = []
        sku, code = r.values.get("sku", "").upper(), r.values.get("store_code", "").upper()
        product, store = products.get(sku), stores.get(code)
        if not sku:
            errors.append("SKU is required.")
        elif product is None:
            errors.append(f"Unknown SKU '{sku[:20]}'. Import the product first.")
        if not code:
            errors.append("Store code is required.")
        elif store is None:
            errors.append(f"Unknown store code '{code[:20]}'.")
        elif not can_manage_store(user, store.id):
            errors.append(f"You can only import stock for your own store ({user.store.code if user.store else 'none'}).")

        quantity_text, reorder_text = r.values.get("quantity", ""), r.values.get("reorder_level", "")
        quantity = int(quantity_text) if WHOLE_NUMBER.match(quantity_text) else None
        if quantity is None or quantity > MAX_QUANTITY:
            errors.append(f"Quantity must be a whole number from 0 to {MAX_QUANTITY:,}.")
        reorder = None
        if reorder_text:
            reorder = int(reorder_text) if WHOLE_NUMBER.match(reorder_text) else None
            if reorder is None or reorder > MAX_REORDER_LEVEL:
                errors.append(f"Reorder level must be a whole number from 0 to {MAX_REORDER_LEVEL:,}.")

        if sku and code and (sku, code) in seen:
            errors.append(f"Duplicate product and store in this file (first seen on row {seen[(sku, code)]}).")
        elif sku and code:
            seen[(sku, code)] = r.number

        notes, changes = [], None
        if errors:
            action = "reject"
        else:
            row = current.get((store.id, product.id))
            if row is None:
                action = "insert"
                notes.append(f"Adds {product.name} to {store.name} stock.")
                changes = {"quantity": [None, quantity]}
            else:
                changes = {}
                if row.quantity != quantity:
                    changes["quantity"] = [row.quantity, quantity]
                if reorder is not None and row.reorder_level != reorder:
                    changes["reorderLevel"] = [row.reorder_level, reorder]
                action = "update" if changes else "skip"
                if not changes:
                    notes.append("Already up to date.")
        planned.append(PlannedRow(
            ImportRowOut(row=r.number, sku=sku or None, name=product.name if product else None, store_code=code or None,
                         action=action, errors=errors, notes=notes, changes=changes or None),
            product, store, quantity or 0, reorder,
        ))
    return planned


def report(filename: str, planned: list[PlannedRow], *, applied: bool) -> ImportReport:
    count = lambda action: sum(1 for p in planned if p.out.action == action)  # noqa: E731
    return ImportReport(
        kind="inventory", filename=filename, applied=applied, update_existing=True, total_rows=len(planned),
        inserted=count("insert"), updated=count("update"), skipped=count("skip"), rejected=count("reject"),
        rows=[p.out for p in planned],
    )


def apply(db: Session, user: User, filename: str, text: str, *, request_id: str | None) -> ImportReport:
    planned = analyze(db, user, text)  # re-validated against the database and the user's store scope
    changes = []
    try:
        for item in planned:
            if item.out.action == "insert":
                db.add(Inventory(store_id=item.store.id, product_id=item.product.id, quantity=item.quantity,
                                 reorder_level=item.reorder_level if item.reorder_level is not None else DEFAULT_REORDER_LEVEL))
                changes.append({"sku": item.product.sku, "store": item.store.code, "previousQuantity": None,
                                "newQuantity": item.quantity})
            elif item.out.action == "update":
                row = db.scalar(
                    select(Inventory)
                    .where(Inventory.store_id == item.store.id, Inventory.product_id == item.product.id)
                    .with_for_update()
                )
                changes.append({"sku": item.product.sku, "store": item.store.code, "previousQuantity": row.quantity,
                                "newQuantity": item.quantity, "reorderLevel": item.reorder_level})
                row.quantity = item.quantity
                if item.reorder_level is not None:
                    row.reorder_level = item.reorder_level
                row.updated_at = func.now()
        db.commit()
    except SQLAlchemyError as exc:
        db.rollback()
        audit.record(action="inventory.import", outcome=AuditOutcome.FAILED, actor=user, entity_type="inventory",
                     entity_id=filename[:64], request_id=request_id,
                     details={"filename": filename, "error": exc.__class__.__name__})
        raise AppError(409, "IMPORT_FAILED", "The stock import could not be saved, so nothing was changed. Preview again and retry.")

    result = report(filename, planned, applied=True)
    audit.record(
        action="inventory.import", outcome=AuditOutcome.SUCCESS, actor=user, entity_type="inventory",
        entity_id=filename[:64], request_id=request_id,
        details={
            "filename": filename, "inserted": result.inserted, "updated": result.updated, "skipped": result.skipped,
            "rejected": result.rejected, "changes": changes[:200],
            "rejectedRows": [{"row": p.out.row, "sku": p.out.sku, "store": p.out.store_code, "errors": p.out.errors}
                             for p in planned if p.out.action == "reject"][:50],
        },
    )
    return result
