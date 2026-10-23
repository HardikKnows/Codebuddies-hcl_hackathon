import json
from datetime import datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.db.session import SessionLocal
from app.models import AuditEvent, User
from app.models.enums import AuditSource
from app.schemas.ops import AuditEventOut


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, default=str))


def record(
    *,
    action: str,
    outcome: str,
    actor: User | None = None,
    source: str = AuditSource.UI,
    entity_type: str | None = None,
    entity_id: Any = None,
    request_id: str | None = None,
    details: dict | None = None,
) -> None:
    """Write an audit event in its own transaction, so denied and failed attempts survive a caller's rollback.

    Callers record successes only after their own commit succeeds.
    """
    with SessionLocal() as db:
        db.add(
            AuditEvent(
                actor_user_id=actor.id if actor else None,
                actor_role=actor.role if actor else None,
                action=action,
                source=source,
                outcome=outcome,
                entity_type=entity_type,
                entity_id=str(entity_id) if entity_id is not None else None,
                request_id=request_id,
                details=_json_safe(details or {}),
            )
        )
        db.commit()


def to_out(event: AuditEvent) -> AuditEventOut:
    return AuditEventOut(
        id=event.id,
        occurred_at=event.occurred_at,
        actor_name=event.actor.full_name if event.actor else None,
        actor_role=event.actor_role,
        action=event.action,
        source=event.source,
        outcome=event.outcome,
        entity_type=event.entity_type,
        entity_id=event.entity_id,
        request_id=event.request_id,
        details=event.details or {},
    )


def list_events(
    db: Session,
    *,
    page: int,
    page_size: int,
    action: str | None = None,
    outcome: str | None = None,
    source: str | None = None,
    entity_type: str | None = None,
    entity_id: str | None = None,
    since: datetime | None = None,
) -> tuple[list[AuditEventOut], int]:
    stmt = select(AuditEvent)
    if action:
        stmt = stmt.where(AuditEvent.action.ilike(f"{action}%"))
    if outcome:
        stmt = stmt.where(AuditEvent.outcome == outcome)
    if source:
        stmt = stmt.where(AuditEvent.source == source)
    if entity_type:
        stmt = stmt.where(AuditEvent.entity_type == entity_type)
    if entity_id:
        stmt = stmt.where(AuditEvent.entity_id == entity_id)
    if since:
        stmt = stmt.where(AuditEvent.occurred_at >= since)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = db.scalars(
        stmt.options(joinedload(AuditEvent.actor))
        .order_by(AuditEvent.occurred_at.desc(), AuditEvent.id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return [to_out(e) for e in rows], total
