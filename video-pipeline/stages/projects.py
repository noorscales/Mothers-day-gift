"""Per-project settings: which Remotion composition renders it, which scene
visuals the scriptwriter may use, the script rules, voice and music."""

PROJECTS: dict[str, dict] = {
    "mothers-day": {
        "composition": "MothersDay",
        "visuals": ["roses", "bouquet", "bag", "perfume", "letter", "hearts", "title"],
        "speaker": "a daughter speaking to her mum; warm, intimate, a little playful",
        "rules": [
            "Line 1 is the hook and must address Mum directly within the first five words.",
            "Use only facts present in the brief; do not invent gifts or memories.",
            "Pick `emotion` per line so the delivery arcs: bright -> warm -> hushed -> tender -> bright.",
        ],
        "voice": {"espeak": "en-gb+f4", "openai": "coral"},
        # I - vi - IV - V in F major, a slow swelling pad.
        "music": {"chords": [(87.31, 174.61, 220.00, 261.63), (73.42, 146.83, 174.61, 220.00),
                             (58.27, 146.83, 174.61, 233.08), (65.41, 130.81, 164.81, 196.00)],
                  "bar": 4.0, "pulse": None},
        "thumbnail_beat": "payoff",
    },
    "trading": {
        "composition": "TradingReel",
        "visuals": ["crash", "risk", "drawdown", "stoploss", "rr", "winrate", "title"],
        "speaker": "an experienced trader talking straight to camera; calm, confident, no hype",
        "rules": [
            "Line 1 is the hook: a counter-intuitive claim a new trader would stop scrolling for.",
            "Every number must be arithmetically correct; show the maths in plain words.",
            "Educational only: no tickers, no price predictions, no promises of profit.",
            "The final line asks the viewer to save the reel and loops back to the hook's idea.",
            "Pick `emotion` per line so the delivery arcs: urgent -> confident -> hushed -> confident -> calm.",
        ],
        "voice": {"espeak": "en-us+m3", "openai": "ash"},
        # i - VI - III - VII in A minor with a soft 100 bpm pulse underneath.
        "music": {"chords": [(55.00, 110.00, 130.81, 164.81), (43.65, 87.31, 110.00, 130.81),
                             (65.41, 130.81, 164.81, 196.00), (49.00, 98.00, 123.47, 146.83)],
                  "bar": 2.4, "pulse": 0.6},
        "thumbnail_beat": "hook",
    },
}
