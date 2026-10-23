"""Turn policy documents (Markdown, text, CSV, JSON, PDF) into titled sections."""

import csv
import io
import json
import re
from dataclasses import dataclass

from pypdf import PdfReader

from app.models.enums import SourceFormat


@dataclass
class Section:
    title: str
    text: str


_ACRONYMS = {"UAE", "AED", "RO", "UV", "PIN", "TV", "OTP", "ID"}
_SMALL_WORDS = {"a", "an", "and", "the", "of", "or", "to", "in", "on", "for", "at", "by"}


def _titleize(heading: str) -> str:
    """'SCREEN CARE AND DAMAGE' -> 'Screen Care and Damage', keeping acronyms and model names like X9 or 5G."""
    words = heading.strip().rstrip(":").split()
    titled = []
    for index, word in enumerate(words):
        if word in _ACRONYMS or any(ch.isdigit() for ch in word):
            titled.append(word)
        elif index > 0 and word.lower() in _SMALL_WORDS:
            titled.append(word.lower())
        else:
            titled.append(word.capitalize())
    return " ".join(titled)


def parse_markdown(text: str) -> list[Section]:
    sections: list[Section] = []
    path: list[str] = []
    buffer: list[str] = []

    def flush() -> None:
        body = "\n".join(buffer).strip()
        if body:
            sections.append(Section(" › ".join(path[1:]) if len(path) > 1 else "Overview", body))
        buffer.clear()

    for line in text.splitlines():
        match = re.match(r"^(#{1,6})\s+(.+?)\s*#*$", line)
        if match:
            flush()
            level = len(match.group(1))
            path[:] = path[: level - 1] + [match.group(2).strip()]
        else:
            buffer.append(line)
    flush()
    return sections


def _is_heading(line: str) -> bool:
    stripped = line.strip()
    return 3 <= len(stripped) <= 60 and stripped.upper() == stripped and any(c.isalpha() for c in stripped)


def parse_text(text: str) -> list[Section]:
    """Plain text and PDF text: short ALL-CAPS lines are section headings."""
    sections: list[Section] = []
    title = "Overview"
    buffer: list[str] = []
    for line in text.splitlines():
        if _is_heading(line):
            body = "\n".join(buffer).strip()
            if body:
                sections.append(Section(title, body))
            buffer.clear()
            title = _titleize(line)
        else:
            buffer.append(line)
    body = "\n".join(buffer).strip()
    if body:
        sections.append(Section(title, body))
    return sections


def _label(key: str) -> str:
    return key.replace("_", " ").strip().capitalize()


def parse_csv(text: str) -> list[Section]:
    """One section per row, titled by the first column."""
    reader = csv.DictReader(io.StringIO(text))
    first = reader.fieldnames[0] if reader.fieldnames else None
    sections = []
    for row in reader:
        lines = [f"{_label(k)}: {v.strip()}" for k, v in row.items() if k and v and v.strip()]
        if lines and first:
            sections.append(Section(row[first].strip(), "\n".join(lines)))
    return sections


def _flatten(value, indent: str = "") -> list[str]:
    lines = []
    for key, item in value.items():
        if isinstance(item, dict):
            lines.append(f"{indent}{_label(key)}:")
            lines += _flatten(item, indent + "  ")
        elif isinstance(item, list):
            lines.append(f"{indent}{_label(key)}: " + "; ".join(str(i) for i in item))
        else:
            lines.append(f"{indent}{_label(key)}: {item}")
    return lines


def parse_json(text: str) -> list[Section]:
    """A list of objects (or an object of objects); each becomes a section titled by its "section" key."""
    data = json.loads(text)
    items = data if isinstance(data, list) else [{"section": k, **v} if isinstance(v, dict) else {"section": k, "value": v} for k, v in data.items()]
    sections = []
    for index, item in enumerate(items, start=1):
        if isinstance(item, dict):
            title = str(item.get("section") or item.get("title") or item.get("name") or f"Item {index}")
            body = "\n".join(_flatten({k: v for k, v in item.items() if k != "section"}))
        else:
            title, body = f"Item {index}", str(item)
        if body.strip():
            sections.append(Section(title, body))
    return sections


def parse_pdf(data: bytes) -> list[Section]:
    reader = PdfReader(io.BytesIO(data))
    return parse_text("\n".join(page.extract_text() or "" for page in reader.pages))


def parse(source_format: str, data: bytes) -> list[Section]:
    if source_format == SourceFormat.PDF:
        return parse_pdf(data)
    text = data.decode("utf-8")
    return {
        SourceFormat.MARKDOWN: parse_markdown,
        SourceFormat.TEXT: parse_text,
        SourceFormat.CSV: parse_csv,
        SourceFormat.JSON: parse_json,
    }[SourceFormat(source_format)](text)
