# Mother's Day short — AI video pipeline

Turns the gift page in this repo into a 9:16 voiced short with animated, word-synced
captions. Five stages, each a small module, connected by JSON/WAV files in `build/`:

```
content/brief.md ──► 1 SCRIPT ──► script.json
                       (Claude)        │
                                       ▼
                     2 VOICE ──► narration.wav + voice.json (line spans)
                     (TTS)             │
                                       ▼
                     4 ALIGN ──► timeline.json + captions.srt
                     (Whisper)         │
                                       ▼
                     3 RENDER ─► video_silent.mp4   (Remotion, React/TS)
                                       │
                                       ▼
                     5 MASTER ─► mothers-day-short.mp4 + thumbnail.png
                     (FFmpeg)
```

Alignment runs before rendering, because every animation frame is computed from the
word timings.

## Quick start

```bash
cd video-pipeline
pip install -r requirements.txt          # optional extras; offline mode needs none
(cd remotion && npm ci)
sudo apt-get install -y ffmpeg espeak-ng # espeak-ng only for the offline voice

python pipeline.py --offline             # no API keys: bundled script + espeak voice
python pipeline.py                       # full run, providers picked from env vars
python pipeline.py --from render         # iterate on the animation only
(cd remotion && npm run studio)          # live preview in Remotion Studio
```

| Env var | Effect |
|---|---|
| `ANTHROPIC_API_KEY` | Stage 1 writes a fresh script with Claude. |
| `ELEVENLABS_API_KEY` (+ `ELEVENLABS_VOICE_ID`) | Stage 2 uses ElevenLabs. |
| `OPENAI_API_KEY` | Stage 2 uses `gpt-4o-mini-tts`, steered by audio prompts. |
| `TTS_PROVIDER` | Force `openai` / `elevenlabs` / `espeak`. |
| `WHISPER_MODEL` | faster-whisper model name (default `base.en`). |
| `REMOTION_BROWSER`, `REMOTION_CONCURRENCY` | Remotion render tuning. |

## The stages

### 1. Scriptwriting and ideation (`stages/script.py`)
- Claude gets the creative brief and returns a script. A Pydantic schema validates it
  (`client.beta.messages.parse`). Server-side refusal fallback is enabled.
- Every line carries:
  - its **beat**: `hook`, `build`, `pattern_interrupt`, `payoff` or `loop`
  - an **emotion**, which drives stage 2
  - a **visual**, which drives stage 3
  - **emphasis** words, which drive the captions
- The prompt sets the retention rules:
  - a hook in the first 3 seconds that names Mum
  - one idea per line
  - a pattern interrupt at about 60% of the runtime
  - an ending that loops back to the opening
- A built-in linter flags weak drafts before any money is spent on TTS: a long hook, a
  missing interrupt, emphasis words that aren't in the line, or lines that are too long.
- Without an API key, `content/script.default.json` is used. It's written to the same rules.

### 2. Voice generation (`stages/voice.py`)
- Each line is synthesised separately, so the delivery can change line by line. Each
  provider gets the emotion in its own form:
  - **OpenAI:** a natural-language audio prompt ("quiet and slower, almost a whisper…")
  - **ElevenLabs:** `stability` and `style` settings per emotion
  - **espeak-ng:** speech rate, pitch and amplitude
- Each clip is trimmed, EQ'd, compressed and loudness-matched. The clips are then joined
  with the pauses the script asks for. The exact span of every line is recorded.

### 3. Programmatic animation (`remotion/`)
- Each frame of the 1080×1920 composition is a pure function of `(frame, timeline.json)`:
  - SVG vector scenes: roses that bloom in rings, the bag with a drawn handle and a
    light sweep, a perfume bottle filling up with mist, a letter whose handwriting draws
    itself, an orbiting heart that beats, and a title whose letters spring in
  - seeded falling petals
  - a gradient background that follows each beat (it turns dark at the pattern interrupt)
  - a retention progress bar
  - kinetic captions where each word pops in at its own timestamp
- Consecutive lines that share a visual play as one continuous shot.

### 4. Speech-to-text and alignment (`stages/align.py`)
- faster-whisper (or openai-whisper) transcribes the narration with word timestamps.
- The recognised words are then aligned back onto the script words with a sequence
  matcher. Captions keep the script's spelling ("Mum", not "Mom") but use the audio's
  timing.
- Words Whisper missed get interpolated timings.
- If no ASR backend is available, a syllable- and punctuation-weighted estimate is used
  inside each line's measured audio span. `timeline.json.alignment` records which
  method was used.

### 5. Media pipeline and rendering (`stages/master.py`)
- **Music bed:** your own track via `--music`, or an ambient pad synthesised with FFmpeg
  (`aevalsrc` I–vi–IV–V chords, reverb and a stereo widener).
- **Mix:** the music is side-chain-ducked under the voice. The mix is then two-pass
  `loudnorm`ed to **-14 LUFS / -1.5 dBTP**.
- **Mux:** the H.264 video stream is copied without re-encoding, with AAC audio, a
  `mov_text` subtitle track and `+faststart`.
- **Outputs:** a thumbnail taken from the emotional payoff, and an ffprobe report.

## Files

```
pipeline.py               orchestrator (--only / --from / --offline / --tts / --music)
content/brief.md          creative brief distilled from ../index.html
content/script.default.json
stages/{script,voice,align,render,master}.py
remotion/src/             Root.tsx, MothersDay.tsx, Captions.tsx, Background.tsx,
                          Petals.tsx, visuals/{Gifts,Moments,shared}.tsx
build/                    generated artefacts (git-ignored)
```
