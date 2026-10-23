"""Tests run against the separate `retailpulse_test` database with a deterministic fake AI client.

The real OpenAI client is never used: no network calls, no cost, repeatable results.
"""

import os

os.environ["DATABASE_URL"] = "postgresql+psycopg://localhost:5432/retailpulse_test"
os.environ["OPENAI_API_KEY"] = ""
os.environ["RAG_MIN_SIMILARITY"] = "0.05"
os.environ["RAG_HIGH_SIMILARITY"] = "0.35"
os.environ["JWT_SECRET"] = "test-only-secret-that-is-long-enough-for-hs256"

import hashlib  # noqa: E402
import json  # noqa: E402
import math  # noqa: E402
import re  # noqa: E402
from pathlib import Path  # noqa: E402

import pytest  # noqa: E402
from alembic import command  # noqa: E402
from alembic.config import Config  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

from app.ai.client import get_ai  # noqa: E402
from app.ai.rag.ingest import ingest_manifest  # noqa: E402
from app.core.config import get_settings  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from scripts import seed_db  # noqa: E402

BACKEND_DIR = Path(__file__).resolve().parents[1]
_STOPWORDS = {"the", "and", "for", "can", "with", "are", "you", "your", "this", "that", "from", "will", "not", "all"}


def fake_embedding(text_value: str) -> list[float]:
    """Hashed bag-of-words vector: deterministic, and similar texts share dimensions."""
    dim = get_settings().embedding_dim
    vector = [0.0] * dim
    for token in re.findall(r"[a-z0-9]+", text_value.lower()):
        if len(token) < 3 or token in _STOPWORDS:
            continue
        vector[int(hashlib.md5(token[:6].encode()).hexdigest(), 16) % dim] += 1.0
    norm = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / norm for v in vector]


class FakeAI:
    model = "fake-chat-model"
    embedding_model = "fake-embedding-model"

    def __init__(self):
        self.parse_handlers = {}  # schema name -> callable(input) -> model instance
        self.parse_inputs = {}  # schema name -> list of inputs seen
        self.tool_calls: list[tuple[str, dict | str]] = []
        self.tool_outputs: list[dict] = []
        self.final_text = "Done."

    def parse(self, *, instructions, input, schema):
        self.parse_inputs.setdefault(schema.__name__, []).append(input)
        handler = self.parse_handlers.get(schema.__name__)
        if handler is None:
            raise AssertionError(f"unexpected parse call for {schema.__name__}")
        return handler(input)

    def run_tools(self, *, instructions, input, tools, call_tool, max_steps=4):
        for name, args in self.tool_calls[:max_steps]:
            raw = args if isinstance(args, str) else json.dumps(args)
            self.tool_outputs.append(json.loads(call_tool(name, raw)))
        return self.final_text

    def embed(self, texts):
        return [fake_embedding(t) for t in texts]


@pytest.fixture(scope="session", autouse=True)
def database():
    with engine.begin() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("script_location", str(BACKEND_DIR / "alembic"))
    command.upgrade(config, "head")
    with SessionLocal() as db:
        seed_db.reset(db)
        seed_db.seed(db)
        db.commit()
        ingest_manifest(db, FakeAI())
    yield


@pytest.fixture
def fake_ai():
    ai = FakeAI()
    app.dependency_overrides[get_ai] = lambda: ai
    yield ai
    app.dependency_overrides.pop(get_ai, None)


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def auth(client):
    tokens = {}

    def headers(email: str) -> dict:
        if email not in tokens:
            response = client.post("/api/auth/login", json={"email": email, "password": seed_db.DEMO_PASSWORD})
            assert response.status_code == 200, response.text
            tokens[email] = response.json()["accessToken"]
        return {"Authorization": f"Bearer {tokens[email]}"}

    return headers


def audit_rows(action: str, outcome: str | None = None) -> list[dict]:
    query = "SELECT action, outcome, entity_id, details FROM audit_events WHERE action = :action"
    params = {"action": action}
    if outcome:
        query += " AND outcome = :outcome"
        params["outcome"] = outcome
    with engine.connect() as conn:
        return [dict(row._mapping) for row in conn.execute(text(query + " ORDER BY id"), params)]


def scalar(sql: str, **params):
    with engine.connect() as conn:
        return conn.execute(text(sql), params).scalar()
