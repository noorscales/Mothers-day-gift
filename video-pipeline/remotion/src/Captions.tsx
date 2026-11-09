import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { PALETTE, SERIF, type Caption, type Word } from "./types";

const HOLD = 0.45; // seconds a chunk lingers after its last word if nothing follows

export type CaptionTheme = {
  font: string;
  weight: number;
  size: number;
  top: number;
  base: string;      // spoken / upcoming words
  active: string;    // word being spoken
  accent: string;    // emphasis words
  accentActive: string;
  stroke: string;
  glow: string;
  shadow: string;
  italicEmphasis: boolean;
  uppercase: boolean;
};

export const ROSE_CAPTIONS: CaptionTheme = {
  font: SERIF,
  weight: 700,
  size: 92,
  top: 1290,
  base: "#FFE4E8",
  active: PALETTE.white,
  accent: "#FFE08A",
  accentActive: PALETTE.gold,
  stroke: "3px rgba(90,0,30,.55)",
  glow: "rgba(255,20,147,.9)",
  shadow: "rgba(90,0,30,.6)",
  italicEmphasis: true,
  uppercase: false,
};

/**
 * Kinetic, word-synchronised captions. Each chunk (<= 4 words) appears as a
 * group; each word pops in at its own timestamp, the word being spoken is
 * scaled and coloured, and script-tagged emphasis words get the accent colour.
 */
export const Captions: React.FC<{ words: Word[]; captions: Caption[]; theme?: CaptionTheme }> = ({
  words,
  captions,
  theme = ROSE_CAPTIONS,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = frame / fps;

  const idx = captions.findIndex((c, i) => {
    const next = captions[i + 1];
    const until = next ? Math.min(next.start, c.end + HOLD) : c.end + HOLD;
    return t >= c.start - 0.05 && t < until;
  });
  if (idx === -1) return null;
  const chunk = captions[idx];

  return (
    <div
      style={{
        position: "absolute",
        left: 70,
        right: 70,
        top: theme.top,
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "center",
        alignItems: "baseline",
        columnGap: 0,
        rowGap: 6,
        fontFamily: theme.font,
        fontWeight: theme.weight,
        fontSize: theme.size,
        textTransform: theme.uppercase ? "uppercase" : "none",
        lineHeight: 1.12,
        textAlign: "center",
      }}
    >
      {chunk.words.map((wi) => {
        const w = words[wi];
        const sinceStart = frame - Math.round(w.start * fps);
        const pop = spring({ frame: sinceStart, fps, config: { damping: 12, stiffness: 180, mass: 0.6 } });
        const active = t >= w.start && t < w.end + 0.06;
        const visible = sinceStart >= -1;
        const color = w.emphasis ? (active ? theme.accentActive : theme.accent) : active ? theme.active : theme.base;
        const lift = interpolate(pop, [0, 1], [40, 0]);
        return (
          <span
            key={wi}
            style={{
              display: "inline-block",
              transformOrigin: "50% 80%",
              margin: "0 0.2em",
              // Upcoming words are shown dimmed so the line stays centred and readable ahead.
              opacity: visible ? 0.35 + 0.65 * Math.min(1, pop * 1.4) : 0.35,
              transform: visible
                ? `translateY(${lift}px) scale(${(active ? 1.08 : 1) * interpolate(pop, [0, 1], [0.85, 1])})`
                : "none",
              color,
              WebkitTextStroke: theme.stroke,
              textShadow: active
                ? `0 0 28px ${theme.glow}, 0 6px 18px ${theme.shadow}`
                : `0 6px 18px ${theme.shadow}`,
              fontStyle: w.emphasis && theme.italicEmphasis ? "italic" : "normal",
            }}
          >
            {w.text}
          </span>
        );
      })}
    </div>
  );
};
