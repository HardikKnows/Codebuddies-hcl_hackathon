from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.ai import assistant
from app.ai.client import AIClient, get_ai
from app.ai.rag.answer import answer_question
from app.ai.recommendations import recommend
from app.api.deps import Ctx, get_ctx, require_permission, require_user
from app.core.permissions import Permission
from app.db.session import get_db
from app.models import DocumentChunk, KnowledgeDocument
from app.schemas.assistant import (
    ActionResult,
    ChatRequest,
    ChatResponse,
    DocumentOut,
    PolicyAnswer,
    PolicyQuestion,
    RecommendationRequest,
    RecommendationResponse,
)
from app.tools.executor import cancel_action, confirm_action

router = APIRouter(tags=["assistant"])


@router.post("/assistant/recommendations", response_model=RecommendationResponse)
def recommendations(
    body: RecommendationRequest,
    ctx: Ctx = Depends(get_ctx),
    db: Session = Depends(get_db),
    ai: AIClient = Depends(get_ai),
):
    return recommend(db, ai, query=body.query, store_id=body.store_id, user=ctx.user, request_id=ctx.request_id)


@router.post("/assistant/policy-answers", response_model=PolicyAnswer)
def policy_answers(
    body: PolicyQuestion,
    ctx: Ctx = Depends(get_ctx),
    db: Session = Depends(get_db),
    ai: AIClient = Depends(get_ai),
):
    return answer_question(db, ai, question=body.question, user=ctx.user, product_sku=body.product_id,
                           request_id=ctx.request_id)


@router.post("/assistant/chat", response_model=ChatResponse)
def chat(body: ChatRequest, ctx: Ctx = Depends(get_ctx), db: Session = Depends(get_db), ai: AIClient = Depends(get_ai)):
    return assistant.chat(db, ai, ctx.user, body, ctx.request_id)


@router.post("/actions/{action_id}/confirm", response_model=ActionResult)
def confirm(action_id: UUID, ctx: Ctx = Depends(require_user), db: Session = Depends(get_db)):
    """The only path that executes an AI-proposed action: an explicit user click, never the model."""
    return confirm_action(db, ctx.user, action_id, ctx.request_id)


@router.post("/actions/{action_id}/cancel", response_model=ActionResult)
def cancel(action_id: UUID, ctx: Ctx = Depends(require_user), db: Session = Depends(get_db)):
    return cancel_action(db, ctx.user, action_id, ctx.request_id)


@router.get("/knowledge/documents", response_model=list[DocumentOut])
def list_documents(ctx: Ctx = Depends(require_permission(Permission.KNOWLEDGE_VIEW)), db: Session = Depends(get_db)):
    counts = dict(db.execute(select(DocumentChunk.document_id, func.count()).group_by(DocumentChunk.document_id)).all())
    docs = db.scalars(
        select(KnowledgeDocument)
        .options(joinedload(KnowledgeDocument.category), joinedload(KnowledgeDocument.product))
        .order_by(KnowledgeDocument.doc_type, KnowledgeDocument.title, KnowledgeDocument.effective_date.desc())
    ).all()
    today = func.current_date()
    current = db.scalar(select(today))
    return [
        DocumentOut(
            id=d.id, doc_key=d.doc_key, title=d.title, doc_type=d.doc_type, version=d.version,
            effective_date=d.effective_date, expiry_date=d.expiry_date, country_code=d.country_code,
            category=d.category.name if d.category else None, product_id=d.product.sku if d.product else None,
            membership_tiers=d.membership_tiers, status=d.status, source_format=d.source_format,
            source_filename=d.source_filename, chunk_count=counts.get(d.id, 0), embedding_model=d.embedding_model,
            in_effect=d.status == "ACTIVE" and d.effective_date <= current and (d.expiry_date is None or d.expiry_date > current),
        )
        for d in docs
    ]
