import React from "react";
import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { T } from "./theme";

export type Candle = { o: number; h: number; l: number; c: number };

/** Seeded random-walk OHLC series; `drift(i)` steers the trend per candle. */
export const makeCandles = (seed: string, n: number, start: number, drift: (i: number) => number, vol = 1.6) => {
  const out: Candle[] = [];
  let price = start;
  for (let i = 0; i < n; i++) {
    const o = price;
    const c = o + drift(i) + (random(`${seed}c${i}`) - 0.5) * vol * 2;
    const h = Math.max(o, c) + random(`${seed}h${i}`) * vol;
    const l = Math.min(o, c) - random(`${seed}l${i}`) * vol;
    out.push({ o, h, l, c });
    price = c;
  }
  return out;
};

/** Candlestick series; `shown` (fractional) reveals candles left to right. */
export const Candles: React.FC<{
  data: Candle[];
  shown: number;
  x0: number;
  width: number;
  y: (price: number) => number;
}> = ({ data, shown, x0, width, y }) => {
  const step = width / data.length;
  return (
    <g>
      {data.map((k, i) => {
        if (i >= shown) return null;
        const grow = Math.min(1, shown - i);
        const up = k.c >= k.o;
        const color = up ? T.green : T.red;
        const cx = x0 + step * (i + 0.5);
        const close = k.o + (k.c - k.o) * grow;
        return (
          <g key={i} opacity={0.4 + 0.6 * grow}>
            <line x1={cx} x2={cx} y1={y(k.o + (k.h - k.o) * grow)} y2={y(k.o + (k.l - k.o) * grow)} stroke={color} strokeWidth={3} />
            <rect
              x={cx - step * 0.32}
              width={step * 0.64}
              y={Math.min(y(k.o), y(close))}
              height={Math.max(3, Math.abs(y(k.o) - y(close)))}
              fill={color}
              rx={2}
            />
          </g>
        );
      })}
    </g>
  );
};

/** Price → y mapping for a chart area. */
export const scale = (min: number, max: number, top: number, bottom: number) => (p: number) =>
  bottom - ((p - min) / (max - min)) * (bottom - top);

export const Stage: React.FC<{ children: React.ReactNode; shake?: number }> = ({ children, shake = 0 }) => {
  const frame = useCurrentFrame();
  const dx = shake * Math.sin(frame * 2.7) * 14;
  const dy = shake * Math.cos(frame * 3.1) * 10;
  return (
    <AbsoluteFill>
      <svg
        viewBox="0 0 1080 1240"
        width={1080}
        height={1240}
        style={{ position: "absolute", top: 70, transform: `translate(${dx}px, ${dy}px)` }}
      >
        {children}
      </svg>
    </AbsoluteFill>
  );
};

export const useSpringAt = (delay: number, damping = 14) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - delay, fps, config: { damping } });
};

export const useRamp = (from: number, to: number) => {
  const frame = useCurrentFrame();
  return interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
};

/** Rounded pill label, e.g. "STOP −1R". */
export const Tag: React.FC<{ x: number; y: number; text: string; color: string; s?: number; size?: number }> = ({
  x,
  y,
  text,
  color,
  s = 1,
  size = 34,
}) => {
  const w = text.length * size * 0.62 + 40;
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} opacity={Math.min(1, s * 1.5)}>
      <rect x={-w / 2} y={-size * 0.95} width={w} height={size * 1.6} rx={size * 0.8} fill={color} />
      <text textAnchor="middle" y={size * 0.28} fontFamily={T.mono} fontWeight={700} fontSize={size} fill="#0B1020">
        {text}
      </text>
    </g>
  );
};

export const Heading: React.FC<{ text: string; sub?: string; y?: number; delay?: number; color?: string }> = ({
  text,
  sub,
  y = 120,
  delay = 0,
  color = T.text,
}) => {
  const s = useSpringAt(delay, 16);
  return (
    <g opacity={s} transform={`translate(540 ${y - (1 - s) * 30})`}>
      <text textAnchor="middle" fontFamily={T.sans} fontWeight={900} fontSize={64} letterSpacing={2} fill={color}>
        {text}
      </text>
      {sub ? (
        <text textAnchor="middle" y={52} fontFamily={T.mono} fontSize={30} letterSpacing={4} fill={T.muted}>
          {sub}
        </text>
      ) : null}
    </g>
  );
};

/** Faint horizontal price grid inside the chart area. */
export const ChartGrid: React.FC<{ top: number; bottom: number; x0?: number; x1?: number; rows?: number }> = ({
  top,
  bottom,
  x0 = 80,
  x1 = 1000,
  rows = 6,
}) => (
  <g>
    {Array.from({ length: rows + 1 }, (_, i) => {
      const yy = top + ((bottom - top) / rows) * i;
      return <line key={i} x1={x0} x2={x1} y1={yy} y2={yy} stroke={T.grid} strokeWidth={2} />;
    })}
  </g>
);
