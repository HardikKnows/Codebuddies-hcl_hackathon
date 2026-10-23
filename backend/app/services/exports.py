"""CSV exports generated from the database, within the requesting user's store scope."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import forbidden, not_found
from app.models import Product, Store, User
from app.models.enums import Availability, Role
from app.services import inventory
from app.services.catalog_import import EXPORT_COLUMNS as CATALOG_COLUMNS
from app.services.catalog_import import format_specifications
from app.services.csv_files import write_csv

INVENTORY_COLUMNS = ["sku", "name", "brand", "category", "price", "image_url", "store_code", "store_name", "quantity",
                     "reorder_level", "status", "updated_at"]
MAX_EXPORT_ROWS = 20_000


def catalog_csv(db: Session) -> tuple[bytes, int, str]:
    products = db.scalars(
        select(Product)
        .options(joinedload(Product.brand), joinedload(Product.category))
        .where(Product.is_active.is_(True))
        .order_by(Product.sku)
    ).all()
    rows = [
        [p.sku, p.name, p.brand.name, p.category.name, p.description, p.price, p.image_url,
         format_specifications(p.specifications)]
        for p in products
    ]
    return write_csv(CATALOG_COLUMNS, rows), len(rows), f"retailpulse-catalog-{date.today().isoformat()}.csv"


def export_store_scope(user: User, store_id: int | None) -> int | None:
    """Admins may export any store or all locations; everyone else only their own store, whatever the client asks."""
    if user.role == Role.ADMIN:
        return store_id
    if user.store_id is None:
        raise forbidden("Your account isn't assigned to a store.")
    if store_id is not None and store_id != user.store_id:
        raise forbidden("You can only export inventory for your own store.", store_id=store_id)
    return user.store_id


def inventory_csv(
    db: Session, *, store_id: int | None, status: Availability | None, q: str | None
) -> tuple[bytes, int, str]:
    store = db.get(Store, store_id) if store_id else None
    if store_id and store is None:
        raise not_found("Store not found.", store_id=store_id)
    rows = inventory.filtered_rows(db, store_id=store_id, status=status, q=q, limit=MAX_EXPORT_ROWS)
    data = [
        [r.product_id, r.product_name, r.brand, r.category, f"{r.price:.2f}", r.image_url, r.store_code, r.store_name, r.quantity,
         r.reorder_level, r.status.value, r.updated_at.isoformat(timespec="seconds")]
        for r in rows
    ]
    parts = ["retailpulse-inventory", store.code if store else "all-locations"]
    if status:
        parts.append(status.value.lower().replace("_", "-"))
    if q:
        parts.append("search")
    return write_csv(INVENTORY_COLUMNS, data), len(data), f"{'-'.join(parts)}-{date.today().isoformat()}.csv"
