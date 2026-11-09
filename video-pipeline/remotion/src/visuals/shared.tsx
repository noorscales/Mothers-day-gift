import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SERIF } from "../types";

export type VisualProps = { frames: number };

/** Stage area for scene art: upper ~60% of the frame, above the captions. */
export const Stage: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <AbsoluteFill>
    <svg viewBox="0 0 1080 1240" width={1080} height={1240} style={{ position: "absolute", top: 60 }}>
      {children}
    </svg>
  </AbsoluteFill>
);

export const useSpring = (delay = 0, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

/** 0..1 progress for "drawing" a stroke between two local frames. */
export const useDraw = (from: number, to: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

export const Label: React.FC<{ text: string; sub?: string; delay?: number; y?: number; dark?: boolean }> = ({
  text,
  sub,
  delay = 8,
  y = 1140,
  dark = false,
}) => {
  const s = useSpring(delay, 16);
  return (
    <g opacity={s} transform={`translate(540 ${y + (1 - s) * 30})`}>
      <text
        textAnchor="middle"
        fontFamily={SERIF}
        fontSize={58}
        fontStyle="italic"
        fill={dark ? "#FFE4E8" : "#8B0000"}
        letterSpacing={2}
      >
        {text}
      </text>
      {sub ? (
        <text
          y={52}
          textAnchor="middle"
          fontFamily={SERIF}
          fontSize={30}
          letterSpacing={8}
          fill={dark ? "#FFB6C1" : "#DC143C"}
        >
          {sub.toUpperCase()}
        </text>
      ) : null}
    </g>
  );
};

export const Sparkle: React.FC<{ x: number; y: number; size: number; phase: number; color?: string }> = ({
  x,
  y,
  size,
  phase,
  color = "#FFF6D6",
}) => {
  const frame = useCurrentFrame();
  const k = Math.max(0, Math.sin(frame / 7 + phase));
  const r = size * k;
  return (
    <path
      d={`M${x},${y - r} Q${x},${y} ${x + r},${y} Q${x},${y} ${x},${y + r} Q${x},${y} ${x - r},${y} Q${x},${y} ${x},${y - r} Z`}
      fill={color}
      opacity={0.9 * k}
    />
  );
};

export const HEART = "M0,-30 C0,-60 -50,-60 -50,-25 C-50,5 -15,25 0,45 C15,25 50,5 50,-25 C50,-60 0,-60 0,-30 Z";
