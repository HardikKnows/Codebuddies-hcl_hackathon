from sqlalchemy import func, select, text
from sqlalchemy.orm import Session, joinedload

from app.core.errors import bad_request, not_found
from app.core.permissions import Permission, has_permission
from app.models import Order, SupportTicket, User
from app.models.enums import AuditOutcome, AuditSource, Role, TicketSource
from app.schemas.tickets import TicketCreate, TicketOut, TicketUpdate
from app.services import audit
from app.services.orders import find_viewable_order


def ticket_out(ticket: SupportTicket) -> TicketOut:
    return TicketOut(
        ticket_number=ticket.ticket_number,
        status=ticket.status,
        priority=ticket.priority,
        category=ticket.category,
        subject=ticket.subject,
        description=ticket.description,
        source=ticket.source,
        order_number=ticket.order.order_number if ticket.order else None,
        customer_name=ticket.customer.full_name,
        created_by_name=ticket.created_by.full_name,
        assigned_to_name=ticket.assigned_to.full_name if ticket.assigned_to else None,
        created_at=ticket.created_at,
        updated_at=ticket.updated_at,
    )


def _load(db: Session, ticket_number: str) -> SupportTicket | None:
    return db.scalar(
        select(SupportTicket)
        .options(
            joinedload(SupportTicket.customer),
            joinedload(SupportTicket.created_by),
            joinedload(SupportTicket.assigned_to),
            joinedload(SupportTicket.order),
        )
        .where(SupportTicket.ticket_number == ticket_number.strip().upper())
    )


def create_ticket(
    db: Session,
    *,
    created_by: User,
    order: Order | None,
    category: str,
    priority: str,
    subject: str,
    description: str,
    source: str,
) -> SupportTicket:
    """Adds a ticket to the session; the caller commits. The customer is the order's owner, or the creator."""
    if order is None and created_by.role != Role.CUSTOMER:
        raise bad_request("ORDER_REQUIRED", "Staff-created tickets must reference an order so the customer is known.")
    number = db.scalar(text("SELECT nextval('ticket_number_seq')"))
    ticket = SupportTicket(
        ticket_number=f"TKT-{number:06d}",
        customer_id=order.customer_id if order else created_by.id,
        order_id=order.id if order else None,
        category=category,
        priority=priority,
        subject=subject.strip(),
        description=description.strip(),
        source=source,
        created_by_id=created_by.id,
    )
    db.add(ticket)
    db.flush()
    return ticket


def create_from_request(db: Session, user: User, req: TicketCreate, request_id: str | None) -> TicketOut:
    order = None
    if req.order_number:
        order = find_viewable_order(db, user, req.order_number)
        if order is None:
            audit.record(action="ticket.create", outcome=AuditOutcome.FAILED, actor=user, request_id=request_id,
                         details={"reason": "Order not found or not accessible", "orderNumber": req.order_number})
            raise not_found(f"Order {req.order_number} was not found.")
    source = TicketSource.WEB if user.role == Role.CUSTOMER else TicketSource.STAFF
    ticket = create_ticket(
        db, created_by=user, order=order, category=req.category, priority=req.priority,
        subject=req.subject, description=req.description, source=source,
    )
    db.commit()
    audit.record(action="ticket.create", outcome=AuditOutcome.SUCCESS, actor=user, source=AuditSource.UI,
                 entity_type="support_ticket", entity_id=ticket.ticket_number, request_id=request_id,
                 details={"orderNumber": req.order_number, "category": req.category, "priority": req.priority})
    return ticket_out(_load(db, ticket.ticket_number))


def list_tickets(
    db: Session,
    user: User,
    *,
    status: str | None,
    priority: str | None,
    source: str | None,
    q: str | None,
    page: int,
    page_size: int,
) -> tuple[list[TicketOut], int]:
    stmt = select(SupportTicket)
    if not has_permission(user.role, Permission.TICKETS_MANAGE):
        stmt = stmt.where(SupportTicket.customer_id == user.id)
    if status:
        stmt = stmt.where(SupportTicket.status == status)
    if priority:
        stmt = stmt.where(SupportTicket.priority == priority)
    if source:
        stmt = stmt.where(SupportTicket.source == source)
    if q:
        like = f"%{q.strip()}%"
        stmt = stmt.where(SupportTicket.subject.ilike(like) | SupportTicket.ticket_number.ilike(like))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    tickets = db.scalars(
        stmt.options(
            joinedload(SupportTicket.customer),
            joinedload(SupportTicket.created_by),
            joinedload(SupportTicket.assigned_to),
            joinedload(SupportTicket.order),
        )
        .order_by(SupportTicket.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [ticket_out(t) for t in tickets], total


def update_ticket(db: Session, user: User, ticket_number: str, req: TicketUpdate, request_id: str | None) -> TicketOut:
    ticket = _load(db, ticket_number)
    if ticket is None:
        raise not_found(f"Ticket {ticket_number} was not found.")
    changes = {}
    if req.status and req.status != ticket.status:
        changes["status"] = {"from": ticket.status, "to": req.status}
        ticket.status = req.status
    if req.priority and req.priority != ticket.priority:
        changes["priority"] = {"from": ticket.priority, "to": req.priority}
        ticket.priority = req.priority
    if req.assign_to_me and ticket.assigned_to_id != user.id:
        changes["assignedTo"] = {"from": ticket.assigned_to.full_name if ticket.assigned_to else None, "to": user.full_name}
        ticket.assigned_to_id = user.id
    if not changes:
        return ticket_out(ticket)
    db.commit()
    audit.record(action="ticket.update", outcome=AuditOutcome.SUCCESS, actor=user, entity_type="support_ticket",
                 entity_id=ticket.ticket_number, request_id=request_id, details={"changes": changes})
    db.expire_all()
    return ticket_out(_load(db, ticket.ticket_number))
