"""Ingest approved policy documents listed in seed/knowledge/manifest.json into pgvector.

Metadata (version, effective dates, country, category, tiers) comes from the manifest, never from the model.
Re-running is safe: unchanged files embedded with the same model are skipped.
"""

import hashlib
import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.ai.client import AIClient
from app.ai.rag.chunking import chunk_sections
from app.ai.rag.parsers import parse
from app.models import Category, DocumentChunk, KnowledgeDocument, Product
from app.models.enums import DocStatus, DocType, MembershipTier, SourceFormat

KNOWLEDGE_DIR = Path(__file__).resolve().parents[3] / "seed" / "knowledge"
FORMATS = {".md": SourceFormat.MARKDOWN, ".txt": SourceFormat.TEXT, ".csv": SourceFormat.CSV,
           ".json": SourceFormat.JSON, ".pdf": SourceFormat.PDF}


@dataclass
class IngestResult:
    file: str
    doc_key: str
    version: str
    status: str  # created | updated | unchanged
    chunks: int


def _optional_date(value: str | None) -> date | None:
    return date.fromisoformat(value) if value else None


def ingest_document(db: Session, ai: AIClient, path: Path, meta: dict) -> IngestResult:
    data = path.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    source_format = FORMATS[path.suffix.lower()]
    doc = db.scalar(
        select(KnowledgeDocument).where(
            KnowledgeDocument.doc_key == meta["docKey"], KnowledgeDocument.version == meta["version"]
        )
    )
    if doc is not None and doc.content_sha256 == digest and doc.embedding_model == ai.embedding_model:
        return IngestResult(path.name, doc.doc_key, doc.version, "unchanged", len(doc.chunks))

    chunks = chunk_sections(parse(source_format, data))
    if not chunks:
        raise ValueError(f"No text could be extracted from {path.name}")
    vectors = ai.embed([f"{meta['title']} › {chunk.title}\n{chunk.text}" for chunk in chunks])

    tiers = meta.get("membershipTiers")
    category_id = product_id = None
    if meta.get("category"):
        category_id = db.scalar(select(Category.id).where(Category.slug == meta["category"]))
        if category_id is None:
            raise ValueError(f"{path.name}: unknown category '{meta['category']}'")
    if meta.get("product"):
        product_id = db.scalar(select(Product.id).where(Product.sku == meta["product"]))
        if product_id is None:
            raise ValueError(f"{path.name}: unknown product '{meta['product']}'")

    status = "updated" if doc is not None else "created"
    if doc is None:
        doc = KnowledgeDocument(doc_key=meta["docKey"], version=meta["version"])
        db.add(doc)
    doc.title = meta["title"]
    doc.doc_type = DocType(meta["docType"])
    doc.effective_date = date.fromisoformat(meta["effectiveDate"])
    doc.expiry_date = _optional_date(meta.get("expiryDate"))
    doc.country_code = meta.get("country")
    doc.category_id = category_id
    doc.product_id = product_id
    doc.membership_tiers = [MembershipTier(t).value for t in tiers] if tiers else None
    doc.status = DocStatus(meta.get("status", DocStatus.ACTIVE))
    doc.source_format = source_format
    doc.source_filename = path.name
    doc.content_sha256 = digest
    doc.embedding_model = ai.embedding_model
    doc.chunks = [
        DocumentChunk(
            chunk_index=index, section_title=chunk.title[:255], content=chunk.text,
            token_count=max(1, len(chunk.text) // 4), embedding=vector,
        )
        for index, (chunk, vector) in enumerate(zip(chunks, vectors))
    ]
    db.commit()
    return IngestResult(path.name, doc.doc_key, doc.version, status, len(chunks))


def ingest_manifest(db: Session, ai: AIClient, directory: Path = KNOWLEDGE_DIR) -> list[IngestResult]:
    manifest = json.loads((directory / "manifest.json").read_text(encoding="utf-8"))
    return [ingest_document(db, ai, directory / entry["file"], entry) for entry in manifest]
