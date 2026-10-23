"""CSV upload parsing and safe CSV generation shared by imports and exports."""

import csv
import io
from collections.abc import Iterable, Sequence
from dataclasses import dataclass

from app.core.errors import AppError, bad_request

MAX_UPLOAD_BYTES = 1_000_000  # 1 MB is plenty for a demo catalog
MAX_ROWS = 500
_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def safe_cell(value) -> object:
    """Neutralise spreadsheet formula injection: text starting with = + - @ (or tab/CR) gets a leading apostrophe."""
    if isinstance(value, str) and value.startswith(_FORMULA_PREFIXES):
        return "'" + value
    return value


def unguard(value: str) -> str:
    """Undo `safe_cell` on import, so an exported file can be re-imported unchanged."""
    return value[1:] if len(value) > 1 and value[0] == "'" and value[1] in "=+-@" else value


def write_csv(columns: Sequence[str], rows: Iterable[Sequence]) -> bytes:
    """UTF-8 with a byte-order mark so Excel shows ₹ and other non-ASCII text correctly."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\r\n")
    writer.writerow(columns)
    for row in rows:
        writer.writerow(["" if value is None else safe_cell(value) for value in row])
    return ("﻿" + buffer.getvalue()).encode("utf-8")


@dataclass
class CsvRow:
    number: int  # spreadsheet row number (the header is row 1)
    values: dict[str, str]
    error: str | None = None


def read_upload(filename: str | None, data: bytes) -> str:
    if not (filename or "").lower().endswith(".csv"):
        raise bad_request("NOT_CSV", "Upload a .csv file.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise AppError(413, "FILE_TOO_LARGE", f"The file is larger than {MAX_UPLOAD_BYTES // 1_000_000} MB.")
    if not data.strip():
        raise bad_request("EMPTY_FILE", "The file is empty.")
    try:
        text = data.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise bad_request("INVALID_ENCODING", "The file must be UTF-8 encoded. In Excel, use 'CSV UTF-8' when saving.")
    if "\x00" in text:
        raise bad_request("NOT_CSV", "This doesn't look like a text CSV file.")
    return text


def parse_csv(
    text: str,
    *,
    required: set[str],
    optional: set[str],
    ignored: frozenset[str] = frozenset(),
    aliases: dict[str, str] | None = None,
) -> tuple[list[str], list[CsvRow]]:
    """Parse and check the header strictly; rows with the wrong shape are returned with an error, not dropped."""
    reader = csv.reader(io.StringIO(text), strict=True)
    try:
        header = next(reader)
    except (StopIteration, csv.Error) as exc:
        raise bad_request("MALFORMED_CSV", f"The header row could not be read ({exc}).")

    aliases = aliases or {}
    columns = []
    for raw in header:
        key = raw.strip().lower().replace(" ", "_").replace("-", "_")
        columns.append(aliases.get(key, key))
    unexpected = [c for c in columns if c not in required | optional | ignored]
    if unexpected:
        allowed = ", ".join(sorted(required | optional))
        raise bad_request("UNEXPECTED_COLUMNS", f"Unexpected column(s): {', '.join(unexpected)}. Allowed columns: {allowed}.",
                          unexpected=unexpected)
    duplicates = sorted({c for c in columns if columns.count(c) > 1})
    if duplicates:
        raise bad_request("DUPLICATE_COLUMNS", f"Column(s) appear more than once: {', '.join(duplicates)}.")
    missing = sorted(required - set(columns))
    if missing:
        raise bad_request("MISSING_COLUMNS", f"Missing required column(s): {', '.join(missing)}.", missing=missing)

    rows: list[CsvRow] = []
    try:
        for index, values in enumerate(reader, start=2):
            if not any(v.strip() for v in values):
                continue  # blank line
            if len(rows) >= MAX_ROWS:
                raise bad_request("TOO_MANY_ROWS", f"The file has more than {MAX_ROWS} data rows. Split it into smaller files.")
            if len(values) > len(columns):
                rows.append(CsvRow(index, {}, f"Row has {len(values)} values but the header has {len(columns)} columns."))
                continue
            padded = values + [""] * (len(columns) - len(values))
            rows.append(CsvRow(index, {c: unguard(v.strip()) for c, v in zip(columns, padded) if c not in ignored}))
    except csv.Error as exc:
        raise bad_request("MALFORMED_CSV", f"The CSV could not be parsed near row {reader.line_num}: {exc}.")
    if not rows:
        raise bad_request("NO_ROWS", "The file has a header but no data rows.")
    return [c for c in columns if c not in ignored], rows
