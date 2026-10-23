from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.db.session import get_db
from app.models import DocumentChunk, KnowledgeDocument

router = APIRouter(tags=["health"])


@router.get("/health")
def health(db: Session = Depends(get_db)):
    """Reports configuration status only; never secret values."""
    settings = get_settings()
    pgvector = db.scalar(text("SELECT extversion FROM pg_extension WHERE extname = 'vector'"))
    return {
        "status": "ok",
        "database": "ok",
        "pgvector": pgvector,
        "ai": {
            "configured": settings.ai_configured,
            "model": settings.openai_model or None,
            "embeddingsConfigured": settings.embeddings_configured,
            "embeddingModel": settings.openai_embedding_model or None,
        },
        "knowledge": {
            "documents": db.scalar(select(func.count()).select_from(KnowledgeDocument)) or 0,
            "chunks": db.scalar(select(func.count()).select_from(DocumentChunk)) or 0,
        },
    }
