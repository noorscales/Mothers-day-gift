import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type { Scene } from "./types";

// Gradient stops per narrative beat; the hushed interrupt goes deep and dark.
const MOODS: Record<Scene["beat"], [string, string, string]> = {
  hook: ["#FFE4E8", "#FFB6C1", "#FF6B8A"],
  build: ["#FFF0F3", "#FFB6C1", "#FF6B8A"],
  pattern_interrupt: ["#5A001E", "#8B0000", "#3A0012"],
  payoff: ["#FFB6C1", "#FF6B8A", "#DC143C"],
  loop: ["#FFE4E8", "#FF6B8A", "#DC143C"],
};

export const Background: React.FC<{ mood: Scene["beat"] }> = ({ mood }) => {
  const frame = useCurrentFrame();
  const [a, b, c] = MOODS[mood];
  const angle = 160 + Math.sin(frame / 90) * 12;
  const glowX = 50 + Math.sin(frame / 70) * 18;
  const glowY = 35 + Math.cos(frame / 85) * 10;
  const glow = interpolate(Math.sin(frame / 40), [-1, 1], [0.25, 0.5]);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ background: `linear-gradient(${angle}deg, ${a} 0%, ${b} 45%, ${c} 100%)` }} />
      <AbsoluteFill
        style={{
          background: `radial-gradient(circle at ${glowX}% ${glowY}%, rgba(255,255,255,${glow}) 0%, transparent 45%)`,
        }}
      />
    </AbsoluteFill>
  );
};
