"""Stage 1 — AI scriptwriting & ideation.

Uses Claude to turn the creative brief into a short-form script engineered for
hook, pacing and retention. Output is validated against a Pydantic schema so
every later stage can rely on its shape. Without an Anthropic credential (or
with --offline) the hand-written `content/script.default.json` is used.
"""
from __future__ import annotations

import os
import shutil
from typing import List, Literal

from pydantic import BaseModel, Field

from .common import CONTENT, SCRIPT_JSON, log, write_json

MODEL = "claude-opus-5-5"

Emotion = Literal["excited", "warm", "playful", "hushed", "tender", "emphatic"]
Visual = Literal["roses", "bouquet", "bag", "perfume", "letter", "hearts", "title"]
Beat = Literal["hook", "build", "pattern_interrupt", "payoff", "loop"]


class Strategy(BaseModel):
    hook: str = Field(description="How the first 3 seconds stop the scroll.")
    pacing: str = Field(description="Rhythm plan: line lengths, where it speeds up / breathes.")
    retention: str = Field(description="Where and how curiosity is re-opened mid-video.")
    loop: str = Field(description="How the ending connects back to the opening for replays.")


class Line(BaseModel):
    id: str = Field(description="short snake_case id")
    beat: Beat
    text: str = Field(description="Exactly what the narrator says. Plain words, no stage directions.")
    emotion: Emotion
    visual: Visual
    emphasis: List[str] = Field(description="Words/phrases from `text` to highlight in captions.")
    pause_after: float = Field(description="Silence after the line, seconds (0.2-1.0).")


class Script(BaseModel):
    title: str
    strategy: Strategy
    lines: List[Line]


SYSTEM = """You are a short-form video scriptwriter who specialises in emotional, \
personal videos. You write for the ear: short sentences, concrete images, one idea \
per line. You understand retention mechanics: a hook in the first 3 seconds, a \
pattern interrupt around 60% of runtime, an emotional payoff, and an ending that \
loops back to the opening so replays feel seamless."""

PROMPT_TEMPLATE = """Write a {seconds}-second vertical video voice-over script from \
this creative brief. It is a gift from a daughter to her mum.

<brief>
{brief}
</brief>

Requirements:
- 7 to 9 lines total, about {words} spoken words overall (narration runs ~2.6 words/sec).
- Line 1 is the hook and must address Mum directly within the first five words.
- Use only facts present in the brief; do not invent gifts or memories.
- `emphasis` entries must appear verbatim in that line's `text`.
- `visual` must be one of the allowed scene visuals in the brief.
- Pick `emotion` per line so the delivery arcs: bright -> warm -> hushed -> tender -> bright."""


def generate_with_claude(seconds: int) -> Script:
    import anthropic  # imported lazily so offline runs do not need the SDK

    brief = (CONTENT / "brief.md").read_text()
    client = anthropic.Anthropic()
    response = client.beta.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(
            seconds=seconds, words=int(seconds * 2.6), brief=brief)}],
        output_format=Script,
        output_config={"effort": "high"},
        # If a safety classifier declines, let the API reroute to a fallback model.
        betas=["server-side-fallback-2026-07-01"],
        fallbacks="default",
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("Claude declined to write the script; use --offline.")
    if response.parsed_output is None:
        raise RuntimeError(f"no structured output (stop_reason={response.stop_reason})")
    return response.parsed_output


def lint(script: Script) -> list[str]:
    """Cheap retention/pacing checks so a weak draft is flagged before TTS spend."""
    issues = []
    words = [len(line.text.split()) for line in script.lines]
    if words and words[0] > 12:
        issues.append(f"hook is {words[0]} words; aim for <= 12 so it lands in ~3 s")
    if script.lines and script.lines[0].beat != "hook":
        issues.append("first line is not tagged as the hook")
    if not any(line.beat == "pattern_interrupt" for line in script.lines):
        issues.append("no pattern interrupt; retention usually dips mid-video")
    for line in script.lines:
        for phrase in line.emphasis:
            if phrase.lower() not in line.text.lower():
                issues.append(f"[{line.id}] emphasis '{phrase}' not found in text")
        if len(line.text.split()) > 22:
            issues.append(f"[{line.id}] {len(line.text.split())} words; split it for pacing")
    return issues


def run(offline: bool = False, seconds: int = 40) -> None:
    has_credentials = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    if offline or not has_credentials:
        reason = "--offline" if offline else "no ANTHROPIC_API_KEY"
        log("script", f"using content/script.default.json ({reason})")
        SCRIPT_JSON.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(CONTENT / "script.default.json", SCRIPT_JSON)
        script = Script.model_validate_json(SCRIPT_JSON.read_text())
    else:
        log("script", f"asking {MODEL} for a {seconds}s script")
        script = generate_with_claude(seconds)
        write_json(SCRIPT_JSON, script.model_dump())

    total_words = sum(len(line.text.split()) for line in script.lines)
    log("script", f"{len(script.lines)} lines, {total_words} words (~{total_words / 2.6:.0f}s spoken)")
    for issue in lint(script):
        log("script", f"lint: {issue}")
