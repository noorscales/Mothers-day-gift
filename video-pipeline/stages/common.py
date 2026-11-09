"""Shared paths, logging and subprocess helpers for every pipeline stage."""
from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONTENT = ROOT / "content"
BUILD = ROOT / "build"
REMOTION = ROOT / "remotion"

# Artefacts handed from one stage to the next.
SCRIPT_JSON = BUILD / "script.json"          # stage 1 -> 2
VOICE_DIR = BUILD / "voice"                  # stage 2 per-line clips
NARRATION_WAV = BUILD / "narration.wav"      # stage 2 -> 4, 5
VOICE_MANIFEST = BUILD / "voice.json"        # stage 2 -> 4 (line spans)
TIMELINE_JSON = BUILD / "timeline.json"      # stage 4 -> 3, 5
CAPTIONS_SRT = BUILD / "captions.srt"        # stage 4 -> 5
VIDEO_SILENT = BUILD / "video_silent.mp4"    # stage 3 -> 5
MUSIC_WAV = BUILD / "music.wav"              # stage 5
FINAL_MP4 = BUILD / "mothers-day-short.mp4"  # stage 5 output
THUMB_PNG = BUILD / "thumbnail.png"          # stage 5 output

FPS = 30
WIDTH, HEIGHT = 1080, 1920


def log(stage: str, msg: str) -> None:
    print(f"[{stage}] {msg}", flush=True)


def run(cmd: list[str], cwd: Path | None = None, quiet: bool = True) -> str:
    """Run a command, raising with its stderr on failure."""
    proc = subprocess.run(
        cmd, cwd=cwd, text=True,
        stdout=subprocess.PIPE if quiet else None,
        stderr=subprocess.PIPE if quiet else None,
    )
    if proc.returncode != 0:
        tail = (proc.stderr or "")[-2000:]
        raise RuntimeError(f"command failed ({proc.returncode}): {' '.join(cmd)}\n{tail}")
    return proc.stdout or ""


def require(binary: str) -> str:
    path = shutil.which(binary)
    if not path:
        raise RuntimeError(f"'{binary}' is not on PATH")
    return path


def read_json(path: Path):
    return json.loads(path.read_text())


def write_json(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


def probe_duration(path: Path) -> float:
    out = run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
               "-of", "default=nw=1:nk=1", str(path)])
    return float(out.strip())
