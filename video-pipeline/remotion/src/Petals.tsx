import React from "react";
import { AbsoluteFill, random, useCurrentFrame, useVideoConfig } from "remotion";

const PETAL = "M0,-22 C14,-18 20,-2 0,22 C-20,-2 -14,-18 0,-22 Z";
const COLORS = ["#FF6B8A", "#FFB6C1", "#FF1493", "#DC143C", "#FFE4E8"];

/** Deterministic falling petals: every property is seeded so renders are reproducible. */
export const Petals: React.FC<{ count: number }> = ({ count }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      <svg width={width} height={height}>
        {Array.from({ length: count }, (_, i) => {
          const speed = 2.2 + random(`s${i}`) * 3.2;
          const travel = height + 200;
          const y = ((random(`y${i}`) * travel + frame * speed) % travel) - 100;
          const sway = Math.sin(frame / (30 + random(`w${i}`) * 40) + i) * (30 + random(`a${i}`) * 50);
          const x = random(`x${i}`) * width + sway;
          const rot = frame * (1 + random(`r${i}`) * 3) * (i % 2 ? 1 : -1);
          const scale = 0.6 + random(`z${i}`) * 1.1;
          return (
            <path
              key={i}
              d={PETAL}
              fill={COLORS[i % COLORS.length]}
              opacity={0.35 + random(`o${i}`) * 0.45}
              transform={`translate(${x} ${y}) rotate(${rot}) scale(${scale} ${scale * 0.7})`}
            />
          );
        })}
      </svg>
    </AbsoluteFill>
  );
};
