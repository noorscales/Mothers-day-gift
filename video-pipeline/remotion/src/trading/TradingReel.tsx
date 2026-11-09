import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Captions } from "../Captions";
import type { Scene, Timeline } from "../types";
import { T, TRADING_CAPTIONS } from "./theme";
import { TRADING_VISUALS } from "./visuals";

const FADE = 6;

const shots = (timeline: Timeline): Scene[] =>
  timeline.scenes.reduce<Scene[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.visual === s.visual) prev.end = s.end;
    else acc.push({ ...s });
    return acc;
  }, []);

/** Navy terminal background with a drifting grid; glow colour follows the beat. */
const Background: React.FC<{ beat: Scene["beat"] }> = ({ beat }) => {
  const frame = useCurrentFrame();
  const glow =
    beat === "hook" ? "rgba(239,68,68,.22)" : beat === "pattern_interrupt" ? "rgba(0,0,0,0)" : beat === "loop" ? "rgba(34,197,94,.2)" : "rgba(245,183,0,.12)";
  const offset = (frame * 0.8) % 80;
  return (
    <AbsoluteFill style={{ background: beat === "pattern_interrupt" ? "#05070F" : `linear-gradient(180deg, ${T.bg} 0%, ${T.bg2} 100%)` }}>
      <AbsoluteFill
        style={{
          backgroundImage: `linear-gradient(${T.grid} 2px, transparent 2px), linear-gradient(90deg, ${T.grid} 2px, transparent 2px)`,
          backgroundSize: "80px 80px",
          backgroundPosition: `${-offset}px ${offset}px`,
          opacity: beat === "pattern_interrupt" ? 0.15 : 0.45,
        }}
      />
      <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, ${glow} 0%, transparent 60%)` }} />
    </AbsoluteFill>
  );
};

const Shot: React.FC<{ frames: number; visual: string; interrupt: boolean }> = ({ frames, visual, interrupt }) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, FADE, frames - FADE, frames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  // Hard punch-in on each cut, then a slow drift: keeps the eye moving.
  const punch = interpolate(f, [0, 8], [1.06, 1], { extrapolateRight: "clamp" });
  const drift = interpolate(f, [0, frames], interrupt ? [1.04, 0.98] : [1, 1.03]);
  const Visual = TRADING_VISUALS[visual];
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${punch * drift})` }}>
      <Visual frames={frames} />
    </AbsoluteFill>
  );
};

export const TradingReel: React.FC<Timeline> = (timeline) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const scene = timeline.scenes.find((s) => t >= s.start && t < s.end) ?? timeline.scenes[0];

  return (
    <AbsoluteFill style={{ fontFamily: T.sans }}>
      <Background beat={scene.beat} />
      {shots(timeline).map((s) => {
        const from = Math.max(0, Math.round(s.start * fps));
        const frames = Math.max(1, Math.round(s.end * fps) - from + FADE);
        return (
          <Sequence key={s.id} from={from} durationInFrames={frames} layout="none">
            <Shot frames={frames} visual={s.visual} interrupt={s.beat === "pattern_interrupt"} />
          </Sequence>
        );
      })}
      <Captions words={timeline.words} captions={timeline.captions} theme={TRADING_CAPTIONS} />

      {/* progress bar */}
      <div style={{ position: "absolute", top: 0, left: 0, height: 10, width: `${(frame / durationInFrames) * 100}%`, background: T.amber }} />
      {/* compliance line, on screen for the whole reel */}
      <div
        style={{
          position: "absolute",
          bottom: 70,
          width: "100%",
          textAlign: "center",
          fontFamily: T.mono,
          fontSize: 28,
          letterSpacing: 3,
          color: T.muted,
        }}
      >
        NOT FINANCIAL ADVICE · EDUCATIONAL ONLY
      </div>
    </AbsoluteFill>
  );
};
