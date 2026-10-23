"""Generate seed/knowledge/zentra-x9-user-manual.pdf, a small real PDF used to demo PDF ingestion.

Usage (from backend/):  .venv/bin/python -m scripts.make_sample_pdf
"""

import textwrap
from pathlib import Path

OUTPUT = Path(__file__).resolve().parents[1] / "seed" / "knowledge" / "zentra-x9-user-manual.pdf"

MANUAL = [
    ("GETTING STARTED", "Press and hold the power button on the right side for 3 seconds to turn on the phone. "
     "Follow the on-screen setup to connect to Wi-Fi and sign in to your account."),
    ("CHARGING", "Use the 67 W charger in the box. A full charge from 0 to 100 percent takes about 45 minutes. "
     "Do not charge the phone while it is wet."),
    ("FACTORY RESET", "To erase all data and restore factory settings, open Settings > System > Reset options > "
     "Erase all data (factory reset), then confirm with your screen lock PIN. If the phone does not respond, turn it "
     "off, then press and hold Power and Volume Down together for 12 seconds to open recovery mode and choose Wipe "
     "data. Back up your data first: a factory reset cannot be undone."),
    ("SCREEN CARE AND DAMAGE", "The display uses toughened glass but can crack if dropped. Do not use a phone with a "
     "cracked screen, as glass fragments can cause injury. Report a screen that is cracked on arrival within 48 hours "
     "of delivery."),
    ("WARRANTY SUPPORT", "The phone has a 1 year manufacturer warranty. For warranty service, raise a support ticket "
     "in the NovaMart app or visit any NovaMart store with your order number."),
]


def _lines() -> list[str]:
    lines = ["ZENTRA X9 5G USER MANUAL", ""]
    for heading, body in MANUAL:
        lines += [heading, *textwrap.wrap(body, 90), ""]
    return lines


def build_pdf(lines: list[str], per_page: int = 48) -> bytes:
    """A minimal valid PDF (Helvetica, A4) with one text line per row."""
    objects: list[bytes] = [b"", b""]  # 1: catalog, 2: page tree (filled in below)
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>")
    font_id = len(objects)
    page_ids = []
    for start in range(0, len(lines), per_page):
        rows = ["BT", "/F1 11 Tf", "15 TL", "56 800 Td"]
        for line in lines[start : start + per_page]:
            escaped = line.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            rows.append(f"({escaped}) Tj T*")
        rows.append("ET")
        stream = "\n".join(rows).encode("latin-1")
        objects.append(b"<< /Length %d >>\nstream\n%s\nendstream" % (len(stream), stream))
        content_id = len(objects)
        objects.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 {font_id} 0 R >> >> "
            f"/Contents {content_id} 0 R >>".encode()
        )
        page_ids.append(len(objects))
    objects[0] = b"<< /Type /Catalog /Pages 2 0 R >>"
    objects[1] = f"<< /Type /Pages /Kids [{' '.join(f'{p} 0 R' for p in page_ids)}] /Count {len(page_ids)} >>".encode()

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for number, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n%s\nendobj\n" % (number, body)
    xref_at = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % offset for offset in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, xref_at)
    return bytes(out)


if __name__ == "__main__":
    OUTPUT.write_bytes(build_pdf(_lines()))
    print(f"Wrote {OUTPUT}")
