from dataclasses import dataclass

import jwt
from fastapi import Depends, Query, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.core.errors import forbidden, unauthorized
from app.core.permissions import Permission, has_permission
from app.core.security import decode_access_token
from app.db.session import get_db
from app.models import User
from app.models.enums import AuditOutcome
from app.services import audit

bearer = HTTPBearer(auto_error=False)


@dataclass
class Ctx:
    """Who is calling and the request id used to correlate audit events."""

    user: User | None
    request_id: str


def get_ctx(
    request: Request,
    db: Session = Depends(get_db),
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
) -> Ctx:
    user = None
    if creds is not None:
        try:
            user_id = decode_access_token(creds.credentials)
        except jwt.PyJWTError:
            raise unauthorized("Your session has expired. Please sign in again.")
        user = db.scalar(
            select(User).options(joinedload(User.profile), joinedload(User.store)).where(User.id == user_id)
        )
        if user is None or not user.is_active:
            raise unauthorized()
    return Ctx(user=user, request_id=request.state.request_id)


def require_user(ctx: Ctx = Depends(get_ctx)) -> Ctx:
    if ctx.user is None:
        raise unauthorized()
    return ctx


def require_permission(permission: Permission):
    def dependency(request: Request, ctx: Ctx = Depends(require_user)) -> Ctx:
        if not has_permission(ctx.user.role, permission):
            audit.record(
                action="access.denied", outcome=AuditOutcome.DENIED, actor=ctx.user, request_id=ctx.request_id,
                details={"permission": permission.value, "path": request.url.path, "method": request.method},
            )
            raise forbidden()
        return ctx

    return dependency


@dataclass
class Pagination:
    page: int
    page_size: int


def pagination(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100, alias="pageSize"),
) -> Pagination:
    return Pagination(page=page, page_size=page_size)
