"""Stage 2 — AI voice generation (text-to-speech).

Each script line is synthesised separately so delivery can change per line
(emotion -> provider-specific prosody / audio prompt), then trimmed, loudness
matched and concatenated with the scripted pauses. The exact span of each line
in the final narration is written to voice.json for the alignment stage.

Providers (choose with --tts or TTS_PROVIDER):
  openai      gpt-4o-mini-tts, emotion steered with a natural-language audio prompt
  elevenlabs  multilingual v2, emotion via stability/style voice settings
  espeak      offline espeak-ng, emotion via rate/pitch/amplitude (robotic but free)
"""
from __future__ import annotations

import json
import os
import urllib.request
from pathlib import Path

from .common import (NARRATION_WAV, SCRIPT_JSON, VOICE_DIR, VOICE_MANIFEST, log,
                     probe_duration, read_json, require, run, write_json)

SAMPLE_RATE = 48000

# Audio prompts for instruction-following TTS (OpenAI). Written like direction
# to a voice actor: who is speaking, to whom, how it should feel.
AUDIO_PROMPTS = {
    "excited": "A young woman talking to her mum, bright and smiling, a little breathless with excitement. Natural, not announcer-like.",
    "warm": "Warm and affectionate, unhurried, a gentle smile in the voice, like sharing a secret with someone you love.",
    "playful": "Playful and teasing, a hint of laughter, lightly emphasising the punchline.",
    "hushed": "Quiet and slower, almost a whisper, as if about to reveal something important. Leave space between words.",
    "tender": "Tender and sincere, slightly emotional, soft and close to the microphone, slowing on the final words.",
    "emphatic": "Clear and heartfelt, with confident emphasis on key words.",
}

# ElevenLabs: lower stability + higher style = more expressive delivery.
ELEVEN_SETTINGS = {
    "excited": {"stability": 0.30, "similarity_boost": 0.8, "style": 0.65},
    "warm": {"stability": 0.50, "similarity_boost": 0.8, "style": 0.40},
    "playful": {"stability": 0.30, "similarity_boost": 0.8, "style": 0.70},
    "hushed": {"stability": 0.70, "similarity_boost": 0.8, "style": 0.20},
    "tender": {"stability": 0.55, "similarity_boost": 0.85, "style": 0.50},
    "emphatic": {"stability": 0.40, "similarity_boost": 0.8, "style": 0.55},
}

# espeak-ng: words/minute, pitch 0-99, amplitude 0-200.
ESPEAK_PROSODY = {
    "excited": {"s": 168, "p": 62, "a": 120},
    "warm": {"s": 150, "p": 50, "a": 110},
    "playful": {"s": 160, "p": 58, "a": 115},
    "hushed": {"s": 128, "p": 40, "a": 80},
    "tender": {"s": 135, "p": 45, "a": 100},
    "emphatic": {"s": 150, "p": 52, "a": 130},
}


def _post(url: str, headers: dict, body: dict, out: Path) -> None:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=120) as resp:
        out.write_bytes(resp.read())


def synth_openai(text: str, emotion: str, out: Path) -> None:
    _post(
        "https://api.openai.com/v1/audio/speech",
        {"Authorization": f"Bearer {os.environ['OPENAI_API_KEY']}", "Content-Type": "application/json"},
        {
            "model": os.environ.get("OPENAI_TTS_MODEL", "gpt-4o-mini-tts"),
            "voice": os.environ.get("OPENAI_TTS_VOICE", "coral"),
            "input": text,
            "instructions": AUDIO_PROMPTS[emotion],
            "response_format": "wav",
        },
        out,
    )


def synth_elevenlabs(text: str, emotion: str, out: Path) -> None:
    voice_id = os.environ.get("ELEVENLABS_VOICE_ID", "21m00Tcm4TlvDq8ikWAM")
    _post(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice_id}?output_format=mp3_44100_128",
        {"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
        {
            "text": text,
            "model_id": os.environ.get("ELEVENLABS_MODEL", "eleven_multilingual_v2"),
            "voice_settings": {**ELEVEN_SETTINGS[emotion], "use_speaker_boost": True},
        },
        out,
    )


def synth_espeak(text: str, emotion: str, out: Path) -> None:
    require("espeak-ng")
    p = ESPEAK_PROSODY[emotion]
    voice = os.environ.get("ESPEAK_VOICE", "en-gb+f4")
    run(["espeak-ng", "-v", voice, "-s", str(p["s"]), "-p", str(p["p"]),
         "-a", str(p["a"]), "-g", "2", "-w", str(out), text])


PROVIDERS = {"openai": synth_openai, "elevenlabs": synth_elevenlabs, "espeak": synth_espeak}


def pick_provider(requested: str | None) -> str:
    if requested:
        return requested
    if os.environ.get("TTS_PROVIDER"):
        return os.environ["TTS_PROVIDER"]
    if os.environ.get("ELEVENLABS_API_KEY"):
        return "elevenlabs"
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    return "espeak"


def normalise_clip(raw: Path, out: Path) -> None:
    """48 kHz mono, trim leading/trailing silence, gentle EQ + per-clip level match."""
    trim = "silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.02"
    chain = ",".join([
        trim, "areverse", trim, "areverse",          # trim both ends
        "highpass=f=80", "lowpass=f=12000",          # remove rumble / hiss
        "acompressor=threshold=-20dB:ratio=3:attack=5:release=80",
        "loudnorm=I=-18:TP=-2:LRA=7",
        f"aresample={SAMPLE_RATE}",
    ])
    run(["ffmpeg", "-y", "-v", "error", "-i", str(raw), "-af", chain,
         "-ac", "1", "-ar", str(SAMPLE_RATE), str(out)])


def run_stage(provider: str | None = None, lead_in: float = 0.4) -> None:
    require("ffmpeg")
    script = read_json(SCRIPT_JSON)
    provider = pick_provider(provider)
    synth = PROVIDERS[provider]
    log("voice", f"provider={provider}, {len(script['lines'])} lines")
    VOICE_DIR.mkdir(parents=True, exist_ok=True)

    concat_list, spans, cursor = [], [], 0.0

    def silence(seconds: float, name: str) -> None:
        nonlocal cursor
        path = VOICE_DIR / f"{name}.wav"
        run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i",
             f"anullsrc=r={SAMPLE_RATE}:cl=mono", "-t", f"{seconds:.3f}", str(path)])
        concat_list.append(path)
        cursor += seconds

    silence(lead_in, "000_lead_in")
    for i, line in enumerate(script["lines"], start=1):
        ext = "mp3" if provider == "elevenlabs" else "wav"
        raw = VOICE_DIR / f"{i:03d}_{line['id']}.raw.{ext}"
        clip = VOICE_DIR / f"{i:03d}_{line['id']}.wav"
        synth(line["text"], line["emotion"], raw)
        normalise_clip(raw, clip)
        dur = probe_duration(clip)
        spans.append({"id": line["id"], "start": round(cursor, 3), "end": round(cursor + dur, 3)})
        concat_list.append(clip)
        cursor += dur
        log("voice", f"  {line['id']:<10} {line['emotion']:<8} {dur:5.2f}s")
        silence(float(line.get("pause_after", 0.3)), f"{i:03d}_pause")

    list_file = VOICE_DIR / "concat.txt"
    list_file.write_text("".join(f"file '{p.resolve()}'\n" for p in concat_list))
    run(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", str(list_file),
         "-c:a", "pcm_s16le", str(NARRATION_WAV)])

    total = probe_duration(NARRATION_WAV)
    write_json(VOICE_MANIFEST, {"provider": provider, "duration": round(total, 3), "lines": spans})
    log("voice", f"narration.wav {total:.2f}s")
