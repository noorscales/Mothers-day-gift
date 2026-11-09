"""Stage 1 — AI scriptwriting & ideation.

Uses Claude to turn the creative brief into a short-form script engineered for
hook, pacing and retention. Output is validated against a Pydantic schema so
every later stage can rely on its shape. Without an Anthropic credential (or
with --offline) the hand-written `content/<project>/script.default.json` is used.
"""
from __future__ import annotations

import os
import re
import shutil
from typing import List, Literal

from pydantic import BaseModel, Field, create_model

from .common import P, log, write_json

MODEL = "claude-opus-5-5"

Emotion = Literal["excited", "warm", "playful", "hushed", "tender", "emphatic",
                  "confident", "urgent", "calm"]
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
    visual: str  # narrowed to the project's visuals by build_models()
    emphasis: List[str] = Field(description="Words/phrases from `text` to highlight in captions.")
    pause_after: float = Field(description="Silence after the line, seconds (0.2-1.0).")


class Script(BaseModel):
    title: str
    strategy: Strategy
    lines: List[Line]


def build_models(visuals: list[str]) -> type[Script]:
    """Script schema whose `visual` field is an enum of the project's scene visuals,
    so Claude's structured output can only pick visuals the renderer can draw."""
    visual_t = Literal.__getitem__(tuple(visuals))
    line = create_model("Line", __base__=Line, visual=(visual_t, ...))
    return create_model("Script", __base__=Script, lines=(List[line], ...))


SYSTEM = """You are a short-form video scriptwriter. You write for the ear: short sentences, concrete images, one idea \
per line. You understand retention mechanics: a hook in the first 3 seconds, a \
pattern interrupt around 60% of runtime, a payoff, and an ending that \
loops back to the opening so replays feel seamless."""

PROMPT_TEMPLATE = """Write a {seconds}-second vertical video voice-over script from \
this creative brief. The narrator is {speaker}.

<brief>
{brief}
</brief>

Requirements:
- 7 to 9 lines total, about {words} spoken words overall (narration runs ~2.6 words/sec).
- `emphasis` entries must appear verbatim in that line's `text`.
- `visual` must be one of the allowed scene visuals in the brief.
{rules}"""


def generate_with_claude(seconds: int, project: dict) -> Script:
    import anthropic  # imported lazily so offline runs do not need the SDK

    brief = (P.CONTENT / "brief.md").read_text()
    client = anthropic.Anthropic()
    response = client.beta.messages.parse(
        model=MODEL,
        max_tokens=16000,
        system=SYSTEM,
        messages=[{"role": "user", "content": PROMPT_TEMPLATE.format(
            seconds=seconds, words=int(seconds * 2.6), brief=brief, speaker=project["speaker"],
            rules="\n".join(f"- {r}" for r in project["rules"]))}],
        output_format=build_models(project["visuals"]),
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
    if script.lines:
        first_sentence = re.split(r"(?<=[.!?])\s", script.lines[0].text)[0]
        if len(first_sentence.split()) > 12:
            issues.append(f"hook's first sentence is {len(first_sentence.split())} words; "
                          "aim for <= 12 so it lands in ~3 s")
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


def run(project: dict, offline: bool = False, seconds: int = 40) -> None:
    has_credentials = bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
    if offline or not has_credentials:
        reason = "--offline" if offline else "no ANTHROPIC_API_KEY"
        log("script", f"using content/{P.PROJECT}/script.default.json ({reason})")
        P.SCRIPT_JSON.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(P.CONTENT / "script.default.json", P.SCRIPT_JSON)
        script = build_models(project["visuals"]).model_validate_json(P.SCRIPT_JSON.read_text())
    else:
        log("script", f"asking {MODEL} for a {seconds}s script")
        script = generate_with_claude(seconds, project)
        write_json(P.SCRIPT_JSON, script.model_dump())

    total_words = sum(len(line.text.split()) for line in script.lines)
    log("script", f"{len(script.lines)} lines, {total_words} words (~{total_words / 2.6:.0f}s spoken)")
    for issue in lint(script):
        log("script", f"lint: {issue}")
