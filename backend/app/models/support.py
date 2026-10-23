from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import TicketCategory, TicketPriority, TicketSource, TicketStatus, check_in


class SupportTicket(Base):
    __tablename__ = "support_tickets"
    __table_args__ = (
        check_in("category", TicketCategory),
        check_in("priority", TicketPriority),
        check_in("status", TicketStatus),
        check_in("source", TicketSource),
        Index("ix_support_tickets_queue", "status", "priority", "created_at"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    ticket_number: Mapped[str] = mapped_column(String(20), unique=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    order_id: Mapped[int | None] = mapped_column(ForeignKey("orders.id"), index=True)
    category: Mapped[str] = mapped_column(String(20))
    priority: Mapped[str] = mapped_column(String(10), server_default=TicketPriority.MEDIUM.value)
    status: Mapped[str] = mapped_column(String(20), server_default=TicketStatus.OPEN.value)
    subject: Mapped[str] = mapped_column(String(160))
    description: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20))
    created_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    assigned_to_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    customer = relationship("User", foreign_keys=[customer_id])
    created_by = relationship("User", foreign_keys=[created_by_id])
    assigned_to = relationship("User", foreign_keys=[assigned_to_id])
    order = relationship("Order")
