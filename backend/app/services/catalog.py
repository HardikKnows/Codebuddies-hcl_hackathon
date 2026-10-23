from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import not_found
from app.models import Brand, Category, Inventory, Product
from app.schemas.catalog import ProductDetail, ProductSummary, StoreAvailability
from app.services.inventory import availability_status, status_for, stock_by_product

SORTS = {"relevance", "rating", "price_asc", "price_desc", "name"}


def category_ids(db: Session, slug: str) -> list[int]:
    """A category and its direct children (e.g. Electronics includes Mobiles and Laptops)."""
    category = db.scalar(select(Category).where(Category.slug == slug))
    if category is None:
        return []
    children = db.scalars(select(Category.id).where(Category.parent_id == category.id)).all()
    return [category.id, *children]


def _short(text: str, limit: int = 120) -> str:
    return text if len(text) <= limit else text[: limit - 1].rsplit(" ", 1)[0] + "…"


def to_summary(product: Product, rows: list[Inventory], store_id: int | None) -> ProductSummary:
    status, quantity = status_for(rows, store_id)
    return ProductSummary(
        product_id=product.sku,
        name=product.name,
        brand=product.brand.name,
        category=product.category.name,
        category_slug=product.category.slug,
        price=float(product.price),
        rating=float(product.rating_avg),
        rating_count=product.rating_count,
        image_url=product.image_url,
        short_description=_short(product.description),
        availability=status,
        available_quantity=quantity,
    )


def list_products(
    db: Session,
    *,
    q: str | None,
    category: str | None,
    brand: str | None,
    min_price: float | None,
    max_price: float | None,
    store_id: int | None,
    in_stock: bool,
    sort: str,
    page: int,
    page_size: int,
) -> tuple[list[ProductSummary], int]:
    stmt = select(Product).join(Brand).where(Product.is_active.is_(True))
    rank = None
    if q and q.strip():
        tsquery = func.plainto_tsquery("english", q.strip())
        like = f"%{q.strip()}%"
        stmt = stmt.where(or_(Product.search_vector.bool_op("@@")(tsquery), Product.name.ilike(like), Brand.name.ilike(like)))
        rank = func.ts_rank(Product.search_vector, tsquery)
    if category:
        stmt = stmt.where(Product.category_id.in_(category_ids(db, category)))
    if brand:
        stmt = stmt.where(func.lower(Brand.name) == brand.strip().lower())
    if min_price is not None:
        stmt = stmt.where(Product.price >= min_price)
    if max_price is not None:
        stmt = stmt.where(Product.price <= max_price)
    if in_stock:
        stock = select(Inventory.product_id).where(Inventory.quantity > 0)
        if store_id:
            stock = stock.where(Inventory.store_id == store_id)
        stmt = stmt.where(Product.id.in_(stock))

    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    order = {
        "price_asc": [Product.price.asc()],
        "price_desc": [Product.price.desc()],
        "name": [Product.name.asc()],
        "rating": [Product.rating_avg.desc(), Product.rating_count.desc()],
    }.get(sort) or ([rank.desc(), Product.rating_avg.desc()] if rank is not None else [Product.rating_avg.desc(), Product.rating_count.desc()])
    products = db.scalars(
        stmt.options(joinedload(Product.brand), joinedload(Product.category))
        .order_by(*order, Product.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    stock = stock_by_product(db, [p.id for p in products])
    return [to_summary(p, stock[p.id], store_id) for p in products], total


def get_product(db: Session, sku: str) -> Product:
    product = db.scalar(
        select(Product)
        .options(joinedload(Product.brand), joinedload(Product.category))
        .where(Product.sku == sku.upper(), Product.is_active.is_(True))
    )
    if product is None:
        raise not_found(f"Product {sku} was not found.", product_id=sku)
    return product


def get_product_detail(db: Session, sku: str, store_id: int | None) -> ProductDetail:
    product = get_product(db, sku)
    rows = stock_by_product(db, [product.id])[product.id]
    summary = to_summary(product, rows, store_id)
    stores = sorted(
        (
            StoreAvailability(
                store_id=r.store.id, store_code=r.store.code, store_name=r.store.name, city=r.store.city,
                type=r.store.type, quantity=r.quantity, status=availability_status(r.quantity, r.reorder_level),
            )
            for r in rows
        ),
        key=lambda s: (s.type != "STORE", s.store_name),
    )
    return ProductDetail(
        **summary.model_dump(), description=product.description, specifications=product.specifications, stores=stores
    )
