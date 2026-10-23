from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.api.deps import Ctx, get_ctx, require_permission, require_user
from app.core.errors import AppError, bad_request
from app.core.permissions import Permission
from app.core.security import create_access_token, verify_password
from app.db.session import get_db
from app.models import Store, User
from app.models.enums import AuditOutcome, StoreType
from app.schemas.auth import LoginRequest, LoginResponse, ProfileUpdate, UserOut
from app.services import audit

router = APIRouter(tags=["auth"])


def user_out(user: User) -> UserOut:
    profile = user.profile
    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        store_id=user.store_id,
        store_name=user.store.name if user.store else None,
        membership_tier=profile.membership_tier if profile else None,
        country_code=profile.country_code if profile else None,
        city=profile.city if profile else None,
        preferred_store_id=profile.preferred_store_id if profile else None,
        preferences=profile.preferences if profile else {},
    )


@router.post("/auth/login", response_model=LoginResponse)
def login(body: LoginRequest, ctx: Ctx = Depends(get_ctx), db: Session = Depends(get_db)):
    email = body.email.strip().lower()
    user = db.scalar(select(User).options(joinedload(User.profile), joinedload(User.store)).where(User.email == email))
    if user is None or not user.is_active or not verify_password(body.password, user.password_hash):
        audit.record(action="auth.login", outcome=AuditOutcome.FAILED, request_id=ctx.request_id,
                     details={"email": email})
        raise AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.")
    return LoginResponse(access_token=create_access_token(user.id, user.role), user=user_out(user))


@router.get("/auth/me", response_model=UserOut)
def me(ctx: Ctx = Depends(require_user)):
    return user_out(ctx.user)


@router.patch("/profile", response_model=UserOut)
def update_profile(
    body: ProfileUpdate, ctx: Ctx = Depends(require_permission(Permission.SHOP)), db: Session = Depends(get_db)
):
    profile = ctx.user.profile
    if body.preferred_store_id is not None:
        store = db.get(Store, body.preferred_store_id)
        if store is None or store.type != StoreType.STORE:
            raise bad_request("INVALID_STORE", "Choose one of the NovaMart stores.")
        profile.preferred_store_id = store.id
    if body.preferences is not None:
        profile.preferences = body.preferences.model_dump(by_alias=True)
    db.commit()
    return user_out(ctx.user)
