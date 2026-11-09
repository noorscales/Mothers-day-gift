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


class _Paths:
    """Per-project artefact paths. `use_project()` points them at build/<project>/."""

    def use(self, project: str) -> None:
        self.PROJECT = project
        self.CONTENT = CONTENT / project
        self.BUILD = BUILD / project
        self.SCRIPT_JSON = self.BUILD / "script.json"          # stage 1 -> 2
        self.VOICE_DIR = self.BUILD / "voice"                  # stage 2 per-line clips
        self.NARRATION_WAV = self.BUILD / "narration.wav"      # stage 2 -> 4, 5
        self.VOICE_MANIFEST = self.BUILD / "voice.json"        # stage 2 -> 4 (line spans)
        self.TIMELINE_JSON = self.BUILD / "timeline.json"      # stage 4 -> 3, 5
        self.CAPTIONS_SRT = self.BUILD / "captions.srt"        # stage 4 -> 5
        self.VIDEO_SILENT = self.BUILD / "video_silent.mp4"    # stage 3 -> 5
        self.MUSIC_WAV = self.BUILD / "music.wav"              # stage 5
        self.FINAL_MP4 = self.BUILD / f"{project}-reel.mp4"    # stage 5 output
        self.THUMB_PNG = self.BUILD / "thumbnail.png"          # stage 5 output


P = _Paths()


def use_project(name: str) -> dict:
    from .projects import PROJECTS

    P.use(name)
    return PROJECTS[name]


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
