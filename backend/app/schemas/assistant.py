from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field

from app.models.enums import Availability
from app.schemas.common import CamelModel


class RecommendationRequest(CamelModel):
    query: str = Field(min_length=3, max_length=500)
    store_id: int | None = None


class RecommendedProduct(CamelModel):
    product_id: str
    name: str
    brand: str
    category: str
    category_slug: str
    price: float  # from the database, never from the model
    rating: float
    image_url: str | None
    availability: Availability  # from the database, never from the model
    available_quantity: int
    reason: str  # the model's explanation


class RecommendationResponse(CamelModel):
    interpreted_requirement: str
    recommendations: list[RecommendedProduct]
    clarifying_question: str | None
    applied_filters: dict
    store_name: str | None


class PolicyQuestion(CamelModel):
    question: str = Field(min_length=3, max_length=500)
    product_id: str | None = None


class PolicySource(CamelModel):
    document_id: int
    document: str
    section: str
    version: str
    effective_date: date
    doc_type: str
    excerpt: str
    similarity: float


class PolicyAnswer(CamelModel):
    answer: str
    confidence: Literal["HIGH", "MEDIUM", "LOW"]
    sources: list[PolicySource]
    follow_up_required: bool


class ChatTurn(CamelModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=4000)


class ChatRequest(CamelModel):
    message: str = Field(min_length=1, max_length=1000)
    history: list[ChatTurn] = Field(default_factory=list, max_length=12)
    store_id: int | None = None
    product_id: str | None = None


class ActionProposal(CamelModel):
    id: UUID
    tool: str
    status: str
    summary: str
    arguments: dict
    expires_at: datetime


class ToolTrace(CamelModel):
    tool: str
    outcome: str
    summary: str


class ChatResponse(CamelModel):
    agent: Literal["shopping", "policy", "support", "inventory", "general"]
    reply: str
    recommendations: RecommendationResponse | None = None
    policy_answer: PolicyAnswer | None = None
    action: ActionProposal | None = None
    tool_trace: list[ToolTrace] = Field(default_factory=list)


class ActionResult(CamelModel):
    id: UUID
    status: str
    result: dict | None
    message: str


class DocumentOut(CamelModel):
    id: int
    doc_key: str
    title: str
    doc_type: str
    version: str
    effective_date: date
    expiry_date: date | None
    country_code: str | None
    category: str | None
    product_id: str | None
    membership_tiers: list[str] | None
    status: str
    source_format: str
    source_filename: str
    chunk_count: int
    embedding_model: str
    in_effect: bool
