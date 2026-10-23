from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import Pagination, pagination
from app.db.session import get_db
from app.models import Brand, Category, Store
from app.schemas.catalog import BrandOut, CategoryOut, ProductDetail, ProductSummary, StoreOut
from app.schemas.common import Page
from app.services import catalog

router = APIRouter(tags=["catalog"])


@router.get("/categories", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    categories = db.scalars(
        select(Category).options(joinedload(Category.parent)).order_by(Category.parent_id.nulls_first(), Category.name)
    ).all()
    return [
        CategoryOut(id=c.id, slug=c.slug, name=c.name, parent_slug=c.parent.slug if c.parent else None)
        for c in categories
    ]


@router.get("/brands", response_model=list[BrandOut])
def list_brands(db: Session = Depends(get_db)):
    return db.scalars(select(Brand).order_by(Brand.name)).all()


@router.get("/stores", response_model=list[StoreOut])
def list_stores(db: Session = Depends(get_db)):
    return db.scalars(select(Store).order_by(Store.type, Store.name)).all()


@router.get("/products", response_model=Page[ProductSummary])
def list_products(
    q: str | None = Query(None, max_length=100),
    category: str | None = Query(None, max_length=60),
    brand: str | None = Query(None, max_length=80),
    min_price: float | None = Query(None, alias="minPrice", ge=0),
    max_price: float | None = Query(None, alias="maxPrice", ge=0),
    store_id: int | None = Query(None, alias="storeId"),
    in_stock: bool = Query(False, alias="inStock"),
    sort: str = Query("relevance", pattern="^(relevance|rating|price_asc|price_desc|name)$"),
    pages: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
):
    items, total = catalog.list_products(
        db, q=q, category=category, brand=brand, min_price=min_price, max_price=max_price, store_id=store_id,
        in_stock=in_stock, sort=sort, page=pages.page, page_size=pages.page_size,
    )
    return Page(items=items, page=pages.page, page_size=pages.page_size, total=total)


@router.get("/products/{sku}", response_model=ProductDetail)
def get_product(sku: str, store_id: int | None = Query(None, alias="storeId"), db: Session = Depends(get_db)):
    return catalog.get_product_detail(db, sku, store_id)
