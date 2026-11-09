"""Stage 5 — media pipeline automation & rendering (FFmpeg).

1. Music bed: a user-supplied track (--music) or a synthesised ambient pad.
2. Mix: music is side-chain ducked under the narration, then the mix is
   two-pass loudness-normalised to -14 LUFS / -1.5 dBTP (short-form platforms).
3. Mux: silent Remotion video + mixed audio + soft-subtitle track, faststart MP4.
4. Deliverables: thumbnail PNG, and a probe report to sanity-check the output.
"""
from __future__ import annotations

import json
import math
import subprocess

from .common import P, log, probe_duration, read_json, require, run

TARGET_LUFS, TARGET_TP, TARGET_LRA = -14.0, -1.5, 11.0

def pad_expression(chords: list, bar: float, pulse: float | None) -> str:
    """aevalsrc expression: chord chosen by time, each bar swells in and out.
    `pulse` (seconds per beat) adds a soft sub-bass thump for a driving feel."""
    idx = f"mod(floor(t/{bar}),{len(chords)})"
    voices = []
    for v in range(4):
        freq = str(chords[-1][v])
        for c in range(len(chords) - 2, -1, -1):
            freq = f"if(eq({idx},{c}),{chords[c][v]},{freq})"
        amp = 0.30 if v == 0 else 0.16
        # fundamental + a quiet octave for warmth
        voices.append(f"{amp}*(sin(2*PI*({freq})*t)+0.25*sin(4*PI*({freq})*t))")
    swell = f"pow(sin(PI*mod(t,{bar})/{bar}),0.6)"
    expr = f"({'+'.join(voices)})*{swell}"
    if pulse:
        # pitch-dropping sine kick: 110 Hz -> 45 Hz with a fast exponential decay
        beat = f"mod(t,{pulse})"
        expr += f"+0.55*sin(2*PI*(45+65*exp(-{beat}*30))*{beat})*exp(-{beat}*9)"
    return expr


def make_music(duration: float, music: str | None, spec: dict) -> None:
    fade_out = max(duration - 2.0, 0)
    if music:
        log("master", f"using music track {music}")
        run(["ffmpeg", "-y", "-v", "error", "-stream_loop", "-1", "-i", music,
             "-t", f"{duration:.3f}", "-af",
             f"afade=t=in:d=1,afade=t=out:st={fade_out:.3f}:d=2,aresample=48000",
             "-ac", "2", str(P.MUSIC_WAV)])
        return
    log("master", "synthesising ambient pad music bed")
    graph = (
        f"aevalsrc='{pad_expression(spec['chords'], spec['bar'], spec.get('pulse'))}':s=48000:d={duration:.3f},"
        "lowpass=f=1800,"
        "tremolo=f=0.25:d=0.15,"
        "aecho=0.8:0.7:120|260:0.35|0.25,"            # cheap room reverb
        "pan=stereo|c0=c0|c1=c0,"
        "extrastereo=m=1.5,"
        f"afade=t=in:d=1.5,afade=t=out:st={fade_out:.3f}:d=2,"
        "volume=-6dB"
    )
    run(["ffmpeg", "-y", "-v", "error", "-f", "lavfi", "-i", graph, str(P.MUSIC_WAV)])


def mix_filter(extra: str) -> str:
    """Voice -> split (one copy keys the compressor); music ducked; mix; loudnorm."""
    return (
        "[0:a]aformat=channel_layouts=stereo,asplit=2[voice][key];"
        "[1:a]volume=0.55[bed];"
        "[bed][key]sidechaincompress=threshold=0.03:ratio=8:attack=20:release=400:makeup=1[ducked];"
        "[voice][ducked]amix=inputs=2:duration=longest:normalize=0,"
        f"loudnorm=I={TARGET_LUFS}:TP={TARGET_TP}:LRA={TARGET_LRA}{extra}"
    )


def measure_loudness(narration, duration) -> dict:
    """Pass 1 of loudnorm: measure the mix. loudnorm reports its JSON on stderr."""
    p = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(narration), "-i", str(P.MUSIC_WAV),
                        "-filter_complex", mix_filter(":print_format=json"), "-t", f"{duration:.3f}",
                        "-f", "null", "-"], text=True, capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr[-2000:])
    return json.loads(p.stderr[p.stderr.rindex("{"):p.stderr.rindex("}") + 1])


def run_stage(project: dict, music: str | None = None) -> None:
    require("ffmpeg")
    timeline = read_json(P.TIMELINE_JSON)
    duration = probe_duration(P.VIDEO_SILENT)
    make_music(duration, music, project["music"])

    # Two-pass loudness normalisation for an accurate, linear gain.
    m = measure_loudness(P.NARRATION_WAV, duration)
    log("master", f"pass 1: {m['input_i']} LUFS, {m['input_tp']} dBTP")
    second = (f":measured_I={m['input_i']}:measured_TP={m['input_tp']}"
              f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}"
              f":offset={m['target_offset']}:linear=true")
    mixed = P.BUILD / "mix.wav"
    run(["ffmpeg", "-y", "-v", "error", "-i", str(P.NARRATION_WAV), "-i", str(P.MUSIC_WAV),
         "-filter_complex", mix_filter(second) + ",aresample=48000",
         "-t", f"{duration:.3f}", "-ar", "48000", str(mixed)])

    # Mux: copy the video stream, encode AAC, attach soft subtitles, faststart.
    run(["ffmpeg", "-y", "-v", "error",
         "-i", str(P.VIDEO_SILENT), "-i", str(mixed), "-i", str(P.CAPTIONS_SRT),
         "-map", "0:v:0", "-map", "1:a:0", "-map", "2:s:0",
         "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-c:s", "mov_text",
         "-metadata:s:s:0", "language=eng", "-metadata", f"title={timeline.get('title', '')}",
         "-t", f"{duration:.3f}", "-movflags", "+faststart", str(P.FINAL_MP4)])

    # Thumbnail: 1.2 s into the project's chosen beat (payoff, hook…), else the midpoint.
    beat = next((s for s in timeline["scenes"] if s["beat"] == project.get("thumbnail_beat")), None)
    at = beat["start"] + 1.2 if beat else duration / 2
    run(["ffmpeg", "-y", "-v", "error", "-ss", f"{at:.2f}", "-i", str(P.VIDEO_SILENT),
         "-frames:v", "1", str(P.THUMB_PNG)])

    report(duration)


def report(expected: float) -> None:
    info = json.loads(run(["ffprobe", "-v", "error", "-show_streams", "-show_format",
                           "-of", "json", str(P.FINAL_MP4)]))
    streams = ", ".join(
        f"{s['codec_type']}:{s['codec_name']}"
        + (f" {s['width']}x{s['height']}@{s['r_frame_rate']}" if s["codec_type"] == "video" else "")
        for s in info["streams"])
    dur = float(info["format"]["duration"])
    size = int(info["format"]["size"]) / 1e6
    log("master", f"{P.FINAL_MP4.name}: {dur:.2f}s, {size:.1f} MB, {streams}")
    if not math.isclose(dur, expected, abs_tol=0.15):
        log("master", f"warning: duration {dur:.2f}s differs from video {expected:.2f}s")
