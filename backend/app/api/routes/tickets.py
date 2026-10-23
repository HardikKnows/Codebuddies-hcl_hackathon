from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import Ctx, Pagination, pagination, require_permission, require_user
from app.core.permissions import Permission
from app.db.session import get_db
from app.models.enums import TicketPriority, TicketSource, TicketStatus
from app.schemas.common import Page
from app.schemas.tickets import TicketCreate, TicketOut, TicketUpdate
from app.services import tickets

router = APIRouter(tags=["tickets"])


@router.post("/tickets", response_model=TicketOut, status_code=201)
def create_ticket(body: TicketCreate, ctx: Ctx = Depends(require_user), db: Session = Depends(get_db)):
    return tickets.create_from_request(db, ctx.user, body, ctx.request_id)


@router.get("/tickets", response_model=Page[TicketOut])
def list_tickets(
    status: TicketStatus | None = None,
    priority: TicketPriority | None = None,
    source: TicketSource | None = None,
    q: str | None = Query(None, max_length=100),
    ctx: Ctx = Depends(require_user),
    pages: Pagination = Depends(pagination),
    db: Session = Depends(get_db),
):
    items, total = tickets.list_tickets(
        db, ctx.user, status=status, priority=priority, source=source, q=q, page=pages.page, page_size=pages.page_size
    )
    return Page(items=items, page=pages.page, page_size=pages.page_size, total=total)


@router.patch("/tickets/{ticket_number}", response_model=TicketOut)
def update_ticket(
    ticket_number: str,
    body: TicketUpdate,
    ctx: Ctx = Depends(require_permission(Permission.TICKETS_MANAGE)),
    db: Session = Depends(get_db),
):
    return tickets.update_ticket(db, ctx.user, ticket_number, body, ctx.request_id)
