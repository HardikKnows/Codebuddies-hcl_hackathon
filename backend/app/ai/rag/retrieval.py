from dataclasses import dataclass, field
from datetime import date

from sqlalchemy import any_, literal, or_, select
from sqlalchemy.orm import Session

from app.ai.client import AIClient
from app.core.config import get_settings
from app.core.permissions import STAFF_ROLES
from app.models import Category, DocumentChunk, KnowledgeDocument, Product, User
from app.models.enums import DocStatus, DocType, Role

DEFAULT_COUNTRY = "IN"  # the storefront serves India unless the signed-in customer says otherwise


@dataclass
class RetrievalScope:
    """Metadata filters applied in SQL before similarity ranking."""

    country: str = DEFAULT_COUNTRY
    tier: str | None = None
    product_id: int | None = None
    product_name: str | None = None
    category_ids: list[int] = field(default_factory=list)
    category_name: str | None = None
    include_internal: bool = False
    as_of: date = field(default_factory=date.today)


@dataclass
class RetrievedChunk:
    chunk_id: int
    document_id: int
    title: str
    section: str
    version: str
    effective_date: date
    doc_type: str
    content: str
    similarity: float


def scope_for(db: Session, user: User | None, product_sku: str | None) -> RetrievalScope:
    scope = RetrievalScope()
    if user is not None and user.profile is not None:
        scope.country = user.profile.country_code
        scope.tier = user.profile.membership_tier
    if user is not None and Role(user.role) in STAFF_ROLES:
        scope.include_internal = True  # store procedures are for staff only
    if product_sku:
        product = db.scalar(select(Product).where(Product.sku == product_sku.strip().upper()))
        if product is not None:
            category = db.get(Category, product.category_id)
            scope.product_id = product.id
            scope.product_name = product.name
            scope.category_ids = [c for c in (category.id, category.parent_id) if c]
            scope.category_name = category.name
    return scope


def retrieve(db: Session, ai: AIClient, question: str, scope: RetrievalScope) -> list[RetrievedChunk]:
    [query_vector] = ai.embed([question])
    distance = DocumentChunk.embedding.cosine_distance(query_vector).label("distance")
    doc = KnowledgeDocument
    stmt = (
        select(DocumentChunk, doc, distance)
        .join(doc, doc.id == DocumentChunk.document_id)
        .where(
            doc.status == DocStatus.ACTIVE,
            doc.effective_date <= scope.as_of,
            or_(doc.expiry_date.is_(None), doc.expiry_date > scope.as_of),
            or_(doc.country_code.is_(None), doc.country_code == scope.country),
        )
    )
    stmt = stmt.where(
        or_(doc.membership_tiers.is_(None), literal(scope.tier) == any_(doc.membership_tiers))
        if scope.tier
        else doc.membership_tiers.is_(None)
    )
    if not scope.include_internal:
        stmt = stmt.where(doc.doc_type != DocType.STORE_PROCEDURE)
    if scope.product_id:
        stmt = stmt.where(
            or_(doc.category_id.is_(None), doc.category_id.in_(scope.category_ids)),
            or_(doc.product_id.is_(None), doc.product_id == scope.product_id),
        )
    rows = db.execute(stmt.order_by(distance).limit(get_settings().rag_top_k)).all()
    return [
        RetrievedChunk(
            chunk_id=chunk.id, document_id=document.id, title=document.title, section=chunk.section_title,
            version=document.version, effective_date=document.effective_date, doc_type=document.doc_type,
            content=chunk.content, similarity=round(1 - float(dist), 4),
        )
        for chunk, document, dist in rows
    ]
