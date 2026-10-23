from datetime import date, datetime

from pgvector.sqlalchemy import Vector
from sqlalchemy import Date, DateTime, ForeignKey, Index, String, Text, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.config import get_settings
from app.db.base import Base
from app.models.enums import DocStatus, DocType, SourceFormat, check_in


class KnowledgeDocument(Base):
    """An approved policy document version. NULL scoping columns mean "applies to all"."""

    __tablename__ = "knowledge_documents"
    __table_args__ = (
        check_in("doc_type", DocType),
        check_in("status", DocStatus),
        check_in("source_format", SourceFormat),
        UniqueConstraint("doc_key", "version", name="uq_knowledge_documents_key_version"),
        # Only one open-ended active version per document.
        Index(
            "uq_knowledge_documents_current",
            "doc_key",
            unique=True,
            postgresql_where=text("status = 'ACTIVE' AND expiry_date IS NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    doc_key: Mapped[str] = mapped_column(String(80))  # stable across versions
    title: Mapped[str] = mapped_column(String(160))
    doc_type: Mapped[str] = mapped_column(String(30))
    version: Mapped[str] = mapped_column(String(20))
    effective_date: Mapped[date] = mapped_column(Date)
    expiry_date: Mapped[date | None] = mapped_column(Date)
    country_code: Mapped[str | None] = mapped_column(String(2))
    category_id: Mapped[int | None] = mapped_column(ForeignKey("categories.id"))
    product_id: Mapped[int | None] = mapped_column(ForeignKey("products.id"))  # product manuals
    membership_tiers: Mapped[list[str] | None] = mapped_column(ARRAY(String(20)))
    status: Mapped[str] = mapped_column(String(20), server_default=DocStatus.ACTIVE.value)
    source_format: Mapped[str] = mapped_column(String(20))
    source_filename: Mapped[str] = mapped_column(String(255))
    content_sha256: Mapped[str] = mapped_column(String(64))
    embedding_model: Mapped[str] = mapped_column(String(100))  # vectors from different models are not comparable
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    category = relationship("Category")
    product = relationship("Product")
    chunks: Mapped[list["DocumentChunk"]] = relationship(
        back_populates="document", cascade="all, delete-orphan", order_by="DocumentChunk.chunk_index"
    )


class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    __table_args__ = (UniqueConstraint("document_id", "chunk_index", name="uq_document_chunks_doc_index"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    document_id: Mapped[int] = mapped_column(ForeignKey("knowledge_documents.id", ondelete="CASCADE"))
    chunk_index: Mapped[int]
    section_title: Mapped[str] = mapped_column(String(255))
    content: Mapped[str] = mapped_column(Text)
    token_count: Mapped[int]
    # No ANN index: exact cosine search stays exact under metadata filters and is fast at this corpus size.
    embedding = mapped_column(Vector(get_settings().embedding_dim), nullable=False)

    document: Mapped[KnowledgeDocument] = relationship(back_populates="chunks")
