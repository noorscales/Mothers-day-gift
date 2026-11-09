import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { Background } from "./Background";
import { Petals } from "./Petals";
import { Captions } from "./Captions";
import { VISUALS } from "./visuals";
import type { Scene, Timeline } from "./types";

const FADE = 9; // frames of cross-fade between scenes

const SceneShell: React.FC<{ frames: number; children: React.ReactNode; interrupt: boolean }> = ({
  frames,
  children,
  interrupt,
}) => {
  const f = useCurrentFrame();
  const opacity = interpolate(f, [0, FADE, frames - FADE, frames], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Slow push-in keeps static shots alive; the pattern interrupt pulls back instead.
  const scale = interpolate(f, [0, frames], interrupt ? [1.12, 1.0] : [1.0, 1.08]);
  return (
    <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>
  );
};

/** Consecutive scenes that share a visual play as one continuous shot. */
const shots = (timeline: Timeline): Scene[] =>
  timeline.scenes.reduce<Scene[]>((acc, s) => {
    const prev = acc[acc.length - 1];
    if (prev && prev.visual === s.visual) prev.end = s.end;
    else acc.push({ ...s });
    return acc;
  }, []);

export const MothersDay: React.FC<Timeline> = (timeline) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const t = frame / fps;
  const scene = timeline.scenes.find((s) => t >= s.start && t < s.end) ?? timeline.scenes[0];

  return (
    <AbsoluteFill>
      <Background mood={scene.beat} />
      <Petals count={26} />

      {shots(timeline).map((s) => {
        const from = Math.max(0, Math.round(s.start * fps));
        const frames = Math.max(1, Math.round(s.end * fps) - from + FADE);
        const Visual = VISUALS[s.visual];
        return (
          <Sequence key={s.id} from={from} durationInFrames={frames} layout="none">
            <SceneShell frames={frames} interrupt={s.beat === "pattern_interrupt"}>
              <Visual frames={frames} />
            </SceneShell>
          </Sequence>
        );
      })}

      <Captions words={timeline.words} captions={timeline.captions} />

      {/* Retention progress bar */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          height: 10,
          width: `${(frame / durationInFrames) * 100}%`,
          background: "linear-gradient(90deg,#FFB6C1,#FF1493)",
          boxShadow: "0 0 18px rgba(255,20,147,.7)",
        }}
      />
      {/* Vignette */}
      <AbsoluteFill
        style={{ background: "radial-gradient(ellipse at center, transparent 55%, rgba(90,0,30,.45) 100%)" }}
      />
    </AbsoluteFill>
  );
};
