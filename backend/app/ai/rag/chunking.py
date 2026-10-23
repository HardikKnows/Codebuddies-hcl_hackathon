import re

from app.ai.rag.parsers import Section

MAX_CHARS = 1200
OVERLAP_CHARS = 150


def _split_long(paragraph: str, limit: int) -> list[str]:
    sentences = re.split(r"(?<=[.!?])\s+", paragraph)
    parts, current = [], ""
    for sentence in sentences:
        if current and len(current) + len(sentence) + 1 > limit:
            parts.append(current)
            current = sentence
        else:
            current = f"{current} {sentence}".strip()
    if current:
        parts.append(current)
    return parts


def chunk_sections(sections: list[Section], max_chars: int = MAX_CHARS, overlap: int = OVERLAP_CHARS) -> list[Section]:
    """Chunks never cross a section boundary, so every chunk keeps an accurate section title for citations."""
    chunks: list[Section] = []
    for section in sections:
        text = re.sub(r"\n{3,}", "\n\n", section.text).strip()
        if len(text) <= max_chars:
            chunks.append(Section(section.title, text))
            continue
        pieces: list[str] = []
        for paragraph in re.split(r"\n\s*\n", text):
            pieces += _split_long(paragraph, max_chars) if len(paragraph) > max_chars else [paragraph]
        current = ""
        for piece in pieces:
            if current and len(current) + len(piece) + 2 > max_chars:
                chunks.append(Section(section.title, current))
                tail = current[-overlap:]
                current = (tail[tail.find(" ") + 1 :] if " " in tail else tail) + "\n\n" + piece
            else:
                current = f"{current}\n\n{piece}".strip()
        if current:
            chunks.append(Section(section.title, current))
    return chunks
