import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { SERIF } from "../types";
import { HEART, Label, Sparkle, Stage, useDraw, useSpring, type VisualProps } from "./shared";

/** Envelope opens, the letter slides out and its handwriting draws itself. */
export const Letter: React.FC<VisualProps> = () => {
  const enter = useSpring(0, 14);
  const flap = useDraw(10, 26); // 0 closed -> 1 open
  const slide = useSpring(24, 15);
  const ink = useDraw(34, 80);
  const lines = [0, 1, 2, 3, 4];
  return (
    <Stage>
      <g opacity={enter} transform={`translate(0 ${(1 - enter) * 120})`}>
        {/* letter (behind the envelope front) */}
        <g transform={`translate(0 ${-slide * 330})`}>
          <rect x={300} y={560} width={480} height={460} rx={10} fill="#FFFAF5" stroke="#F0C9CF" strokeWidth={3} />
          <text x={340} y={640} fontFamily={SERIF} fontStyle="italic" fontSize={50} fill="#DC143C" opacity={ink > 0 ? 1 : 0}>
            Mum,
          </text>
          {lines.map((i) => {
            const p = interpolate(ink, [i / lines.length, (i + 1) / lines.length], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            const w = i === lines.length - 1 ? 220 : 380;
            return (
              <path
                key={i}
                d={`M340,${690 + i * 52} q 30,-14 60,0 t 60,0 t 60,0 t 60,0 t 60,0 t 60,0`}
                stroke="#B03A52"
                strokeWidth={4}
                fill="none"
                strokeLinecap="round"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - p}
                transform={`scale(${w / 380} 1)`}
                style={{ transformOrigin: "340px 0px" }}
              />
            );
          })}
        </g>
        {/* envelope body */}
        <path d="M260,640 L820,640 L820,1000 L260,1000 Z" fill="#FFD6DE" />
        <path d="M260,1000 L540,800 L820,1000 Z" fill="#FFC2CE" />
        <path d="M260,640 L540,840 L260,1000 Z" fill="#FFCCD6" />
        <path d="M820,640 L540,840 L820,1000 Z" fill="#FFCCD6" />
        {/* flap: flips from closed (pointing down) to open (pointing up) */}
        <path
          d="M260,640 L540,840 L820,640 Z"
          fill="#FFB6C1"
          stroke="#F59AAE"
          strokeWidth={2}
          transform={`translate(0 640) scale(1 ${1 - 2 * flap}) translate(0 -640)`}
        />
        <path d={HEART} transform={`translate(540 ${845 - flap * 10}) scale(0.7)`} fill="#DC143C" opacity={1 - flap} />
      </g>
      <Label text="A letter from my heart" sub="words I never say enough" dark />
    </Stage>
  );
};

/** Beating heart with smaller hearts orbiting it. */
export const Hearts: React.FC<VisualProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = useSpring(0, 10);
  // lub-dub: two quick pulses per ~1 s
  const beatPhase = (frame % fps) / fps;
  const beat = 1 + 0.08 * Math.exp(-((beatPhase - 0.1) ** 2) / 0.002) + 0.05 * Math.exp(-((beatPhase - 0.3) ** 2) / 0.002);
  return (
    <Stage>
      <defs>
        <radialGradient id="heartfill" cx="0.4" cy="0.35" r="0.8">
          <stop offset="0" stopColor="#FF6B8A" />
          <stop offset="1" stopColor="#B0102F" />
        </radialGradient>
      </defs>
      <g transform={`translate(540 600) scale(${5.4 * enter * beat})`}>
        <path d={HEART} fill="url(#heartfill)" stroke="#FFE4E8" strokeWidth={1.2} />
      </g>
      {Array.from({ length: 10 }, (_, i) => {
        const a = (i / 10) * Math.PI * 2 + frame / 40;
        const r = 380 + Math.sin(frame / 20 + i) * 20;
        const s = spring({ frame: frame - 6 - i * 2, fps, config: { damping: 12 } });
        return (
          <path
            key={i}
            d={HEART}
            fill={i % 2 ? "#FFB6C1" : "#FF1493"}
            transform={`translate(${540 + Math.cos(a) * r} ${600 + Math.sin(a) * r * 0.85}) scale(${0.55 * s})`}
            opacity={0.85}
          />
        );
      })}
      <Sparkle x={300} y={300} size={30} phase={1} />
      <Sparkle x={800} y={360} size={24} phase={3} />
      <Label text="My greatest privilege" sub="being your daughter" />
    </Stage>
  );
};

/** Title card used for the hook and the looping sign-off. */
export const Title: React.FC<VisualProps> = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const line1 = "Happy";
  const line2 = "Mother's Day";
  const letters = (text: string, y: number, size: number, offset: number, color: string) =>
    text.split("").map((ch, i, chars) => {
      const s = spring({ frame: frame - offset - i * 2, fps, config: { damping: 10, stiffness: 160 } });
      // Per-glyph advance so narrow characters (apostrophe, space) don't leave gaps.
      const adv = (c: string) => (c === "'" ? 0.24 : c === " " ? 0.3 : 0.58) * size;
      const total = chars.reduce((sum, c) => sum + adv(c), 0);
      const before = chars.slice(0, i).reduce((sum, c) => sum + adv(c), 0);
      const x = 540 - total / 2 + before + adv(ch) / 2;
      return (
        <text
          key={`${text}-${i}`}
          x={x}
          y={y + (1 - s) * 80}
          textAnchor="middle"
          fontFamily={SERIF}
          fontWeight={700}
          fontSize={size}
          fill={color}
          opacity={s}
          stroke="#FFFFFF"
          strokeWidth={3}
          paintOrder="stroke"
        >
          {ch}
        </text>
      );
    });
  const mum = useSpring(26, 9);
  const ring = useDraw(0, 40);
  return (
    <Stage>
      <circle
        cx={540}
        cy={560}
        r={400}
        fill="none"
        stroke="#FFFFFF"
        strokeOpacity={0.7}
        strokeWidth={5}
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - ring}
        transform="rotate(-90 540 560)"
      />
      {letters(line1, 470, 150, 0, "#DC143C")}
      {letters(line2, 640, 120, 8, "#8B0000")}
      <g transform={`translate(540 820) scale(${mum}) rotate(${(1 - mum) * -12})`}>
        <text textAnchor="middle" fontFamily={SERIF} fontStyle="italic" fontSize={170} fill="#FF1493" stroke="#FFFFFF" strokeWidth={4} paintOrder="stroke">
          Mum
        </text>
        <path d={HEART} transform="translate(275 -125) scale(0.7)" fill="#DC143C" />
      </g>
      <Sparkle x={240} y={260} size={36} phase={0} />
      <Sparkle x={850} y={330} size={28} phase={2} />
      <Sparkle x={820} y={900} size={30} phase={4} />
    </Stage>
  );
};
