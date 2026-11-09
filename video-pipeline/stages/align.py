"""Stage 4 — speech-to-text & word-level timestamp alignment.

Runs Whisper over the finished narration with word timestamps, then aligns the
recognised words back onto the *script* words (so captions keep the script's
spelling and punctuation while using the audio's timing). Words Whisper missed
get interpolated timings. Output: timeline.json (drives the animation) and
captions.srt (burn-in / platform upload).

ASR backends, tried in order: faster-whisper, openai-whisper. If neither (or no
model weights) is available, a syllable-weighted estimate inside each line's
known audio span is used; it is clearly flagged in timeline.json.
"""
from __future__ import annotations

import os
import re
from difflib import SequenceMatcher

from .common import (CAPTIONS_SRT, FPS, NARRATION_WAV, SCRIPT_JSON, TIMELINE_JSON,
                     VOICE_MANIFEST, log, read_json, write_json)

WHISPER_MODEL = os.environ.get("WHISPER_MODEL", "base.en")


def norm(token: str) -> str:
    return re.sub(r"[^a-z0-9']", "", token.lower().replace("’", "'"))


# ---------------------------------------------------------------- ASR backends
def transcribe_faster_whisper() -> list[dict]:
    from faster_whisper import WhisperModel

    model = WhisperModel(WHISPER_MODEL, device="auto", compute_type="int8")
    segments, _ = model.transcribe(str(NARRATION_WAV), word_timestamps=True,
                                   vad_filter=False, language="en")
    return [{"word": w.word.strip(), "start": w.start, "end": w.end}
            for seg in segments for w in (seg.words or [])]


def transcribe_openai_whisper() -> list[dict]:
    import whisper

    model = whisper.load_model(WHISPER_MODEL)
    result = model.transcribe(str(NARRATION_WAV), word_timestamps=True, language="en")
    return [{"word": w["word"].strip(), "start": w["start"], "end": w["end"]}
            for seg in result["segments"] for w in seg.get("words", [])]


def transcribe() -> tuple[str, list[dict]] | tuple[None, None]:
    for name, fn in (("faster-whisper", transcribe_faster_whisper),
                     ("openai-whisper", transcribe_openai_whisper)):
        try:
            words = fn()
            if words:
                return name, words
        except Exception as exc:  # missing package, blocked model download, etc.
            log("align", f"{name} unavailable: {type(exc).__name__}: {str(exc)[:120]}")
    return None, None


# ----------------------------------------------------------- script alignment
def syllables(word: str) -> int:
    groups = re.findall(r"[aeiouy]+", norm(word))
    n = len(groups) - (1 if norm(word).endswith("e") and len(groups) > 1 else 0)
    return max(1, n)


def estimate_line(words: list[str], start: float, end: float) -> list[tuple[float, float]]:
    """Distribute a line's span over its words by syllables + punctuation pauses."""
    weights, gaps = [], []
    for w in words:
        weights.append(syllables(w) + 0.6)
        gaps.append(0.9 if w[-1:] in ".!?" else 0.5 if w[-1:] in ",;:—" else 0.0)
    total = sum(weights) + sum(gaps[:-1])
    scale = (end - start) / total if total else 0
    out, t = [], start
    for w, g in zip(weights, gaps):
        out.append((t, t + w * scale))
        t += (w + g) * scale
    return out


def align_to_script(script_words: list[dict], asr: list[dict]) -> int:
    """Copy ASR timings onto matching script words. Returns number matched."""
    a = [norm(w["text"]) for w in script_words]
    b = [norm(w["word"]) for w in asr]
    matched = 0
    for block in SequenceMatcher(a=a, b=b, autojunk=False).get_matching_blocks():
        for k in range(block.size):
            sw, aw = script_words[block.a + k], asr[block.b + k]
            sw["start"], sw["end"], sw["src"] = aw["start"], aw["end"], "asr"
            matched += 1
    return matched


def fill_gaps(script_words: list[dict]) -> None:
    """Interpolate words ASR did not match, between their timed neighbours."""
    i = 0
    while i < len(script_words):
        if script_words[i].get("src") == "asr":
            i += 1
            continue
        j = i
        while j < len(script_words) and script_words[j].get("src") != "asr":
            j += 1
        est = sum(w["est_end"] - w["est_start"] for w in script_words[i:j])
        if i > 0 and j < len(script_words):          # gap between two timed words
            lo, hi = script_words[i - 1]["end"], script_words[j]["start"]
        elif j < len(script_words):                  # leading gap: end at first timed word
            hi = script_words[j]["start"]
            lo = max(0.0, hi - est)
        elif i > 0:                                  # trailing gap: start after last timed word
            lo = script_words[i - 1]["end"]
            hi = lo + est
        else:                                        # nothing matched at all
            lo, hi = script_words[0]["est_start"], script_words[-1]["est_end"]
        span = max(hi - lo, 0.05 * (j - i))
        for k in range(i, j):
            frac0, frac1 = (k - i) / (j - i), (k - i + 1) / (j - i)
            script_words[k]["start"] = lo + span * frac0
            script_words[k]["end"] = lo + span * frac1
            script_words[k]["src"] = "interp"
        i = j


# ---------------------------------------------------------------- outputs
def srt_time(t: float) -> str:
    ms = int(round(t * 1000))
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d},{ms:03d}"


def caption_chunks(words: list[dict], max_words: int = 4) -> list[list[dict]]:
    chunks, cur = [], []
    for w in words:
        if cur and (w["line"] != cur[-1]["line"] or len(cur) >= max_words):
            chunks.append(cur)
            cur = []
        cur.append(w)
        if w["text"][-1:] in ".!?,":
            chunks.append(cur)
            cur = []
    if cur:
        chunks.append(cur)
    return chunks


def write_srt(chunks: list[list[dict]]) -> None:
    blocks = []
    for n, chunk in enumerate(chunks, start=1):
        text = " ".join(w["text"] for w in chunk)
        blocks.append(f"{n}\n{srt_time(chunk[0]['start'])} --> {srt_time(chunk[-1]['end'])}\n{text}\n")
    CAPTIONS_SRT.write_text("\n".join(blocks))


def run_stage(tail: float = 0.6) -> None:
    script = read_json(SCRIPT_JSON)
    voice = read_json(VOICE_MANIFEST)
    spans = {s["id"]: s for s in voice["lines"]}

    # Script words with an estimated time inside the line's known span.
    words: list[dict] = []
    for li, line in enumerate(script["lines"]):
        tokens = line["text"].split()
        span = spans[line["id"]]
        emph = {norm(t) for phrase in line.get("emphasis", []) for t in phrase.split()}
        for tok, (s, e) in zip(tokens, estimate_line(tokens, span["start"], span["end"])):
            words.append({"text": tok, "line": li, "emphasis": norm(tok) in emph,
                          "est_start": s, "est_end": e})

    backend, asr = transcribe()
    if asr:
        matched = align_to_script(words, asr)
        fill_gaps(words)
        log("align", f"{backend}: {len(asr)} ASR words, matched {matched}/{len(words)} script words")
    else:
        backend = "estimate"
        for w in words:
            w["start"], w["end"], w["src"] = w["est_start"], w["est_end"], "estimate"
        log("align", "no ASR backend available; using syllable-weighted estimates per line")

    for i, w in enumerate(words):
        w["index"] = i
        w["start"], w["end"] = round(w.pop("start"), 3), round(w.pop("end"), 3)
        w.pop("est_start"), w.pop("est_end")

    duration = round(voice["duration"] + tail, 3)
    scenes = []
    for li, line in enumerate(script["lines"]):
        start = 0.0 if li == 0 else spans[line["id"]]["start"] - 0.15
        nxt = script["lines"][li + 1]["id"] if li + 1 < len(script["lines"]) else None
        end = spans[nxt]["start"] - 0.15 if nxt else duration
        scenes.append({k: line[k] for k in ("id", "beat", "visual", "emotion", "text")}
                      | {"start": round(start, 3), "end": round(end, 3)})

    chunks = caption_chunks(words)
    write_srt(chunks)
    write_json(TIMELINE_JSON, {
        "fps": FPS,
        "duration": duration,
        "durationInFrames": int(round(duration * FPS)),
        "title": script.get("title", ""),
        "alignment": backend,
        "scenes": scenes,
        "words": words,
        "captions": [{"start": c[0]["start"], "end": c[-1]["end"],
                      "words": [w["index"] for w in c]} for c in chunks],
    })
    log("align", f"timeline.json: {len(scenes)} scenes, {len(words)} words, {duration:.2f}s")
