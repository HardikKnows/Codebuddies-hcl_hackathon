"""List the models your OPENAI_API_KEY can use and verify the configured model IDs.

Usage (from backend/):  .venv/bin/python -m scripts.check_openai [--live]
--live also sends one tiny request to each configured model and checks the embedding size.
"""

import argparse
import sys

from openai import OpenAI

from app.core.config import get_settings


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--live", action="store_true", help="send one tiny test request to each configured model")
    args = parser.parse_args()

    settings = get_settings()
    if not settings.openai_api_key:
        print("OPENAI_API_KEY is not set in backend/.env")
        return 1
    client = OpenAI(api_key=settings.openai_api_key)
    ids = sorted(model.id for model in client.models.list())
    print(f"{len(ids)} models are available to this key.")
    print("Models containing 'luna':", ", ".join(i for i in ids if "luna" in i.lower()) or "none")
    print("GPT models:", ", ".join(i for i in ids if i.startswith("gpt-")) or "none")
    print("Embedding models:", ", ".join(i for i in ids if "embedding" in i) or "none")

    ok = True
    for name, value in (("OPENAI_MODEL", settings.openai_model), ("OPENAI_EMBEDDING_MODEL", settings.openai_embedding_model)):
        if not value:
            print(f"[missing] {name} is not set")
            ok = False
        elif value in ids:
            print(f"[ok]      {name}={value}")
        else:
            print(f"[error]   {name}={value} is not available to this key")
            ok = False

    if args.live and ok:
        reply = client.responses.create(model=settings.openai_model, input="Reply with the single word OK.")
        print("Live chat test:", reply.output_text.strip()[:40])
        request = {"model": settings.openai_embedding_model, "input": ["test"]}
        if settings.openai_embedding_model.startswith("text-embedding-3"):
            request["dimensions"] = settings.embedding_dim
        size = len(client.embeddings.create(**request).data[0].embedding)
        verdict = "matches EMBEDDING_DIM" if size == settings.embedding_dim else f"EMBEDDING_DIM is {settings.embedding_dim}: change it and re-create the schema"
        print(f"Live embedding test: {size} dimensions ({verdict})")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
