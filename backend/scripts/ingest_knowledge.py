"""Embed the approved policy documents listed in seed/knowledge/manifest.json into pgvector.

Usage (from backend/):  .venv/bin/python -m scripts.ingest_knowledge
Needs OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL in backend/.env. Safe to re-run.
"""

import sys

from app.ai.client import get_ai
from app.ai.rag.ingest import ingest_manifest
from app.core.config import get_settings
from app.core.errors import AppError
from app.db.session import SessionLocal


def main() -> int:
    if not get_settings().embeddings_configured:
        print("Set OPENAI_API_KEY and OPENAI_EMBEDDING_MODEL in backend/.env first (see `python -m scripts.check_openai`).")
        return 1
    try:
        ai = get_ai()
        with SessionLocal() as db:
            results = ingest_manifest(db, ai)
    except AppError as exc:
        print(f"Ingestion failed: {exc.message}")
        return 1
    for r in results:
        print(f"{r.status:9s}  {r.doc_key} v{r.version:<8s} {r.chunks:3d} chunks  ({r.file})")
    print(f"{len(results)} documents processed.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
