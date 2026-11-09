import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Label, Sparkle, Stage, useDraw, useSpring, type VisualProps } from "./shared";

/** A rose built from rotated petal ellipses that bloom outward in rings. */
const Rose: React.FC<{ x: number; y: number; size: number; delay: number; hue?: string }> = ({
  x,
  y,
  size,
  delay,
  hue = "#DC143C",
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const bloomAt = (d: number) => spring({ frame: frame - d, fps, config: { damping: 11 } });
  const stem = useDraw(delay, delay + 18);
  const rings = [
    { n: 7, r: 0.95, color: "#B0102F" },
    { n: 6, r: 0.75, color: hue },
    { n: 5, r: 0.55, color: "#E8314F" },
    { n: 4, r: 0.35, color: "#FF4D6D" },
  ];
  const sway = Math.sin((frame + delay * 3) / 28) * 3;
  return (
    <g transform={`translate(${x} ${y}) rotate(${sway})`}>
      <path
        d={`M0,0 C ${-size * 0.3},${size * 1.4} ${size * 0.3},${size * 2.2} 0,${size * 3.2}`}
        stroke="#2E7D32"
        strokeWidth={size * 0.09}
        fill="none"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        strokeDashoffset={1 - stem}
      />
      <path
        d={`M0,${size * 1.6} q ${size * 0.6},${-size * 0.4} ${size * 0.9},${size * 0.1} q ${-size * 0.5},${size * 0.35} ${-size * 0.9},${-size * 0.1}`}
        fill="#43A047"
        opacity={stem}
      />
      {rings.map((ring, ri) => {
        const bloom = bloomAt(delay + 10 + ri * 5);
        return Array.from({ length: ring.n }, (_, pi) => {
          const a = (360 / ring.n) * pi + ri * 23 + frame * 0.15 * (ri % 2 ? -1 : 1);
          return (
            <ellipse
              key={`${ri}-${pi}`}
              cx={0}
              cy={-size * ring.r * 0.45 * bloom}
              rx={size * ring.r * 0.42}
              ry={size * ring.r * 0.6}
              fill={ring.color}
              stroke="#7A0019"
              strokeOpacity={0.35}
              strokeWidth={2}
              transform={`rotate(${a}) scale(${bloom})`}
            />
          );
        });
      })}
      <circle r={size * 0.12 * bloomAt(delay + 30)} fill="#7A0019" />
    </g>
  );
};

export const Roses: React.FC<VisualProps> = () => (
  <Stage>
    <Rose x={540} y={430} size={190} delay={0} />
    <Rose x={300} y={560} size={130} delay={8} hue="#FF1493" />
    <Rose x={780} y={560} size={130} delay={14} hue="#FF6B8A" />
    <Label text="A bouquet of roses" sub="each one a love note" />
  </Stage>
);

export const Bouquet: React.FC<VisualProps> = () => (
  <Stage>
    {[[540, 380, 120, 0], [400, 450, 100, 5], [680, 450, 100, 9], [470, 300, 90, 13], [610, 300, 90, 17]].map(
      ([x, y, s, d], i) => (
        <Rose key={i} x={x} y={y} size={s} delay={d} hue={i % 2 ? "#FF1493" : "#DC143C"} />
      ),
    )}
    <path d="M330,620 L540,1020 L750,620 Z" fill="#1B1B1B" opacity={0.92} />
    <path d="M330,620 L540,1020 L750,620" fill="none" stroke="#E8B04B" strokeWidth={6} />
    <Label text="Wrapped with love" sub="a luxury bouquet" />
  </Stage>
);

/** Structured handbag silhouette: body springs up, handle draws, lock catches light. */
export const Bag: React.FC<VisualProps> = () => {
  const frame = useCurrentFrame();
  const body = useSpring(0, 12);
  const handle = useDraw(10, 32);
  const lock = useSpring(28, 9);
  const shine = interpolate(frame % 75, [0, 40], [-300, 1300], { extrapolateRight: "clamp" });
  return (
    <Stage>
      <defs>
        <linearGradient id="leather" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#F28C38" />
          <stop offset="1" stopColor="#B4531A" />
        </linearGradient>
        <clipPath id="bagclip">
          <path d="M250,520 L830,520 L870,980 Q870,1010 840,1010 L240,1010 Q210,1010 210,980 Z" />
        </clipPath>
      </defs>
      <g transform={`translate(540 760) scale(${body}) translate(-540 -760)`}>
        <path
          d="M380,520 C380,300 700,300 700,520"
          fill="none"
          stroke="#9A4514"
          strokeWidth={34}
          strokeLinecap="round"
          pathLength={1}
          strokeDasharray={1}
          strokeDashoffset={1 - handle}
        />
        <path d="M250,520 L830,520 L870,980 Q870,1010 840,1010 L240,1010 Q210,1010 210,980 Z" fill="url(#leather)" />
        <g clipPath="url(#bagclip)">
          <rect x={shine} y={480} width={120} height={600} fill="white" opacity={0.18} transform="skewX(-20)" />
        </g>
        <path d="M240,520 L840,520 L820,680 Q540,740 260,680 Z" fill="#C8642A" stroke="#8A3B10" strokeWidth={4} />
        <path d="M250,560 L830,560" stroke="#FCE2C8" strokeWidth={3} strokeDasharray="14 10" opacity={0.7} />
        <g transform={`translate(540 700) scale(${lock})`}>
          <rect x={-46} y={-30} width={92} height={74} rx={12} fill="#E8B04B" stroke="#9C7420" strokeWidth={4} />
          <circle cy={8} r={10} fill="#9C7420" />
        </g>
      </g>
      <Sparkle x={300} y={470} size={34} phase={0} />
      <Sparkle x={820} y={600} size={26} phase={2} />
      <Sparkle x={560} y={330} size={22} phase={4} />
      <Label text="The Birkin, darling" sub="for the most iconic woman I know" />
    </Stage>
  );
};

/** Perfume bottle: liquid rises, spritz mist puffs out on a loop. */
export const Perfume: React.FC<VisualProps> = () => {
  const frame = useCurrentFrame();
  const enter = useSpring(0, 13);
  const fill = useDraw(6, 40);
  return (
    <Stage>
      <defs>
        <linearGradient id="glass" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
          <stop offset="0.5" stopColor="#FFE4E8" stopOpacity={0.25} />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity={0.5} />
        </linearGradient>
        <clipPath id="bottle">
          <rect x={360} y={480} width={360} height={470} rx={60} />
        </clipPath>
      </defs>
      <g transform={`translate(0 ${(1 - enter) * 300})`} opacity={enter}>
        <rect x={500} y={400} width={80} height={90} rx={10} fill="#E8B04B" />
        <rect x={470} y={320} width={140} height={90} rx={22} fill="#F4E3C1" stroke="#C9A35A" strokeWidth={4} />
        <g clipPath="url(#bottle)">
          <rect x={360} y={950 - 420 * fill} width={360} height={470} fill="#FFC2A8" opacity={0.85} />
          <path
            d={`M360,${950 - 420 * fill} q 45,${Math.sin(frame / 6) * 10} 90,0 t 90,0 t 90,0 t 90,0 v 30 h -360 z`}
            fill="#FFD9C7"
          />
        </g>
        <rect x={360} y={480} width={360} height={470} rx={60} fill="url(#glass)" stroke="#FFFFFF" strokeWidth={6} />
        <rect x={420} y={640} width={240} height={130} rx={8} fill="#FFF8F0" opacity={0.92} />
        <text x={540} y={712} textAnchor="middle" fontFamily="Georgia, serif" fontSize={46} fill="#5A2A1A">
          Chloé
        </text>
        <text x={540} y={750} textAnchor="middle" fontFamily="Georgia, serif" fontSize={18} letterSpacing={5} fill="#5A2A1A">
          EAU DE PARFUM
        </text>
      </g>
      {Array.from({ length: 6 }, (_, i) => {
        const cycle = (frame + i * 8) % 48;
        const p = cycle / 48;
        return (
          <circle
            key={i}
            cx={640 + p * 260 + i * 6}
            cy={360 - p * 120 + Math.sin(i) * 30}
            r={14 + p * 60}
            fill="#FFFFFF"
            opacity={(1 - p) * 0.35 * enter}
          />
        );
      })}
      <Label text="Your signature scent" sub="soft · feminine · unforgettable" />
    </Stage>
  );
};
