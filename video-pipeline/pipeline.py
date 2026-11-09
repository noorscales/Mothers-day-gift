#!/usr/bin/env python3
"""Mother's Day short-form video pipeline.

    script -> voice -> align -> render -> master

  1 script  Claude writes a hook/pacing/retention-engineered script (stages/script.py)
  2 voice   per-line emotional TTS, trimmed + concatenated   (stages/voice.py)
  3 align   Whisper word timestamps aligned to the script    (stages/align.py)
  4 render  Remotion (React/TS) renders 1080x1920 frames     (stages/render.py)
  5 master  FFmpeg music bed, ducking, loudnorm, mux, thumb  (stages/master.py)

Examples:
  python pipeline.py                       # everything, auto-picks providers
  python pipeline.py --offline             # no network: default script + espeak
  python pipeline.py --from render         # re-render after editing the animation
  python pipeline.py --only voice --tts openai
"""
from __future__ import annotations

import argparse
import sys
import time

from stages import align, master, render, script, voice
from stages.common import FINAL_MP4, log

ORDER = ["script", "voice", "align", "render", "master"]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--only", choices=ORDER, help="run a single stage")
    ap.add_argument("--from", dest="start", choices=ORDER, help="start at this stage")
    ap.add_argument("--offline", action="store_true", help="use the bundled script and espeak-ng")
    ap.add_argument("--seconds", type=int, default=40, help="target length for the AI script")
    ap.add_argument("--tts", choices=sorted(voice.PROVIDERS), help="TTS provider")
    ap.add_argument("--music", help="music file for the bed (default: synthesised pad)")
    ap.add_argument("--concurrency", help="Remotion render concurrency")
    args = ap.parse_args()

    stages = [args.only] if args.only else ORDER[ORDER.index(args.start or "script"):]
    actions = {
        "script": lambda: script.run(offline=args.offline, seconds=args.seconds),
        "voice": lambda: voice.run_stage("espeak" if args.offline and not args.tts else args.tts),
        "align": align.run_stage,
        "render": lambda: render.run_stage(args.concurrency),
        "master": lambda: master.run_stage(args.music),
    }
    t0 = time.time()
    for name in stages:
        t = time.time()
        actions[name]()
        log(name, f"done in {time.time() - t:.1f}s")
    if "master" in stages:
        log("pipeline", f"finished in {time.time() - t0:.1f}s -> {FINAL_MP4}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
