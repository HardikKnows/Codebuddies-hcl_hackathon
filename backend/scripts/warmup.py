"""Warm up the AI before a live demo.

OpenAI compiles each new structured-output schema on first use, which can make the very first request
take a minute; later requests reuse the compiled schema. Run this once shortly before presenting.

Usage (from backend/):  .venv/bin/python -m scripts.warmup
"""

import sys
import time
from concurrent.futures import ThreadPoolExecutor

from app.ai.assistant import Route
from app.ai.client import get_ai
from app.ai.rag.answer import PolicyDraft
from app.ai.recommendations import Ranking, ShoppingIntent
from app.core.errors import AppError

PROBES = [
    (Route, "hello"),
    (ShoppingIntent, "Categories (slug: name): laptops: Laptops\nBrands: Aerion\nRequest: a laptop"),
    (Ranking, "Shopper request: a laptop\nCandidates:\n{'product_id': 'P101', 'name': 'Aerion Swift 14'}"),
    (PolicyDraft, "Question: test\n\nPolicy excerpts:\n[chunk 1] Test · v1 · effective 2026-01-01 › Test\nNo content."),
]


def main() -> int:
    try:
        ai = get_ai()
    except AppError as exc:
        print(exc.message)
        return 1

    def probe(item):
        schema, text = item
        start = time.time()
        ai.parse(instructions="Reply briefly.", input=text, schema=schema)
        return schema.__name__, time.time() - start

    with ThreadPoolExecutor(max_workers=len(PROBES)) as pool:
        for name, seconds in pool.map(probe, PROBES):
            print(f"{name:15s} ready in {seconds:5.1f}s")
    ai.embed(["warm up"])
    print("Embeddings ready. The assistant is warm.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
