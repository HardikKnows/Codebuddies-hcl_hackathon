from typing import Literal

from pydantic import Field

from app.schemas.common import CamelModel


class ImportRowOut(CamelModel):
    row: int  # spreadsheet row number (the header is row 1)
    sku: str | None
    name: str | None = None
    store_code: str | None = None
    action: Literal["insert", "update", "skip", "reject"]
    errors: list[str] = Field(default_factory=list)
    notes: list[str] = Field(default_factory=list)
    changes: dict | None = None  # field -> [current, new]


class ImportReport(CamelModel):
    """Preview (applied=false) and result (applied=true) share one shape; counts are per action."""

    kind: Literal["products", "inventory"]
    filename: str
    applied: bool
    update_existing: bool
    total_rows: int
    inserted: int
    updated: int
    skipped: int
    rejected: int
    rows: list[ImportRowOut]
