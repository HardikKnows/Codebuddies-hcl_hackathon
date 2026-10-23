"""Generates one narration clip per line of src/narration.json with OpenAI text-to-speech.

Run with the backend's virtualenv so the API key comes from backend/.env:
    ../backend/.venv/bin/python scripts/voiceover.py [--model gpt-4o-mini-tts] [--only v01,s02]

Writes public/voice/<id>.wav and src/voice-durations.json (seconds per line), which the video uses to
time captions. Existing clips are kept unless their line is listed with --only.
"""

import argparse
import json
import sys
import wave
from pathlib import Path

VIDEO_DIR = Path(__file__).resolve().parent.parent
BACKEND_DIR = VIDEO_DIR.parent / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from openai import OpenAI  # noqa: E402

from app.core.config import get_settings  # noqa: E402


def fix_streamed_header(path: Path) -> None:
    """Streamed WAV responses carry 0xFFFFFFFF as the RIFF and data sizes; write the real ones."""
    data = bytearray(path.read_bytes())
    if data[:4] != b"RIFF" or data[36:40] != b"data":
        return
    data[4:8] = (len(data) - 8).to_bytes(4, "little")
    data[40:44] = (len(data) - 44).to_bytes(4, "little")
    path.write_bytes(bytes(data))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default="gpt-4o-mini-tts")
    parser.add_argument("--only", default="", help="comma-separated line ids to (re)generate")
    args = parser.parse_args()

    narration = json.loads((VIDEO_DIR / "src" / "narration.json").read_text())
    only = {i for i in args.only.split(",") if i}
    out_dir = VIDEO_DIR / "public" / "voice"
    out_dir.mkdir(parents=True, exist_ok=True)
    client = OpenAI(api_key=get_settings().openai_api_key)

    durations = {}
    for line in narration["lines"]:
        path = out_dir / f"{line['id']}.wav"
        if not path.exists() or line["id"] in only:
            with client.audio.speech.with_streaming_response.create(
                model=args.model,
                voice=narration["voice"],
                input=line.get("speak", line["text"]),
                instructions=narration["instructions"],
                response_format="wav",
            ) as response:
                response.stream_to_file(path)
            fix_streamed_header(path)
        with wave.open(str(path)) as clip:
            durations[line["id"]] = round(clip.getnframes() / clip.getframerate(), 3)
        print(f"{line['id']}  {durations[line['id']]:5.2f}s  {line['text']}")

    (VIDEO_DIR / "src" / "voice-durations.json").write_text(json.dumps(durations, indent=2) + "\n")


if __name__ == "__main__":
    main()
