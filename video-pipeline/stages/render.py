"""Stage 3 — programmatic animation (Remotion, React/TypeScript).

The timeline from stage 4 is passed to the Remotion composition as input
props; every frame is a pure function of (frame, timeline), so captions and
scene changes land on the word timings. Renders a silent H.264 video. The
audio is added in stage 5, where it can be mixed and loudness-normalised.
"""
from __future__ import annotations

import os
import shutil

from .common import REMOTION, TIMELINE_JSON, VIDEO_SILENT, log, require, run


def browser_executable() -> str | None:
    for candidate in (os.environ.get("REMOTION_BROWSER"), "/opt/pw-browsers/chromium",
                      shutil.which("chromium"), shutil.which("google-chrome")):
        if candidate and os.path.exists(candidate):
            return candidate
    return None  # Remotion downloads its own headless shell


def run_stage(concurrency: str | None = None) -> None:
    require("npx")
    if not (REMOTION / "node_modules").exists():
        log("render", "installing Remotion dependencies (npm ci)")
        run(["npm", "ci", "--no-audit", "--no-fund"], cwd=REMOTION)

    cmd = ["npx", "remotion", "render", "src/index.ts", "MothersDay", str(VIDEO_SILENT),
           f"--props={TIMELINE_JSON}", "--codec=h264", "--crf=18", "--muted",
           "--log=warn"]
    if browser := browser_executable():
        cmd.append(f"--browser-executable={browser}")
    if concurrency or os.environ.get("REMOTION_CONCURRENCY"):
        cmd.append(f"--concurrency={concurrency or os.environ['REMOTION_CONCURRENCY']}")
    log("render", "rendering frames with Remotion …")
    run(cmd, cwd=REMOTION, quiet=False)
    log("render", f"wrote {VIDEO_SILENT.name}")
