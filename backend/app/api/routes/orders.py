from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import Ctx, Pagination, pagination, require_permission, require_user
from app.core.permissions import Permission
from app.db.session import get_db
from app.schemas.common import Page
from app.schemas.orders import OrderOut, OrderSummary, PlaceOrderRequest, QuoteRequest, QuoteResponse
from app.services import orders

router = APIRouter(tags=["orders"])


@router.post("/cart/quote", response_model=QuoteResponse)
def quote_cart(body: QuoteRequest, db: Session = Depends(get_db)):
    """Prices and stock are always recomputed from the database; the client-side cart only holds ids and quantities."""
    return orders.quote(db, body)


@router.post("/orders", response_model=OrderOut, status_code=201)
def place_order(
    body: PlaceOrderRequest, ctx: Ctx = Depends(require_permission(Permission.SHOP)), db: Session = Depends(get_db)
):
    return orders.place_order(db, ctx.user, body, ctx.request_id)


@router.get("/orders", response_model=Page[OrderSummary])
def my_orders(
    ctx: Ctx = Depends(require_user), pages: Pagination = Depends(pagination), db: Session = Depends(get_db)
):
    items, total = orders.list_orders(db, customer_id=ctx.user.id, page=pages.page, page_size=pages.page_size)
    return Page(items=items, page=pages.page, page_size=pages.page_size, total=total)


@router.get("/orders/{order_number}", response_model=OrderOut)
def get_order(order_number: str, ctx: Ctx = Depends(require_user), db: Session = Depends(get_db)):
    return orders.get_order_out(db, ctx.user, order_number, ctx.request_id)
