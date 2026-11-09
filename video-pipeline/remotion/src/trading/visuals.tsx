import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { Candles, ChartGrid, Heading, Stage, Tag, makeCandles, scale, useRamp, useSpringAt } from "./chart";
import { T } from "./theme";

type P = { frames: number };
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const fmt = (n: number, d = 0) => n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });

// ------------------------------------------------------------------ crash
const CRASH = makeCandles("crash", 30, 100, (i) => (i < 19 ? 0.9 : i < 24 ? -7.5 : -2.2), 1.8);

/** Hook: a steady uptrend, then an oversized position gets wiped. */
export const Crash: React.FC<P> = ({ frames }) => {
  const frame = useCurrentFrame();
  const shown = interpolate(frame, [0, frames * 0.75], [0, CRASH.length], clamp);
  const dumped = shown > 20;
  const dumpS = useSpringAt(Math.round((20 / CRASH.length) * frames * 0.75), 9);
  const pnl = interpolate(shown, [19, 30], [0, -50], clamp);
  const y = scale(40, 130, 240, 1000);
  return (
    <Stage shake={dumped ? Math.max(0, 1 - (shown - 20) / 6) : 0}>
      <ChartGrid top={240} bottom={1000} />
      <Candles data={CRASH} shown={shown} x0={80} width={920} y={y} />
      <Heading text="POSITION SIZE: 25%" sub="one trade · whole account exposed" y={120} color={dumped ? T.red : T.text} />
      <g opacity={dumpS} transform={`translate(540 ${1110 - (1 - dumpS) * 40})`}>
        <text textAnchor="middle" fontFamily={T.mono} fontWeight={800} fontSize={120} fill={T.red}>
          {fmt(pnl)}%
        </text>
      </g>
      {dumped ? <rect x={0} y={0} width={1080} height={1240} fill={T.red} opacity={Math.max(0, 0.25 - (shown - 20) * 0.06)} /> : null}
    </Stage>
  );
};

// ------------------------------------------------------------------ risk
/** Rule 1: a $10,000 account as a ring; a 1% slice pops out. */
export const Risk: React.FC<P> = () => {
  const ring = useRamp(0, 26);
  const slice = useSpringAt(26, 9);
  const counter = useRamp(30, 60);
  const R = 300;
  const C = 2 * Math.PI * R;
  // The 1% arc is only 3.6°, so it is drawn wider and pulled out to read on a phone.
  const sliceDeg = 3.6;
  const mid = (-90 + sliceDeg / 2) * (Math.PI / 180);
  const pop = 60 * slice;
  return (
    <Stage>
      <Heading text="ACCOUNT $10,000" sub="max risk per trade" y={120} />
      <g transform="translate(540 560)">
        <circle r={R} fill="none" stroke={T.grid} strokeWidth={80} />
        <circle
          r={R}
          fill="none"
          stroke={T.green}
          strokeOpacity={0.85}
          strokeWidth={80}
          strokeDasharray={`${C * 0.99 * ring} ${C}`}
          transform={`rotate(${-90 + sliceDeg})`}
        />
        <g transform={`translate(${Math.cos(mid) * pop} ${Math.sin(mid) * pop})`} opacity={slice}>
          <circle
            r={R}
            fill="none"
            stroke={T.amber}
            strokeWidth={110}
            strokeDasharray={`${C * 0.012} ${C}`}
            transform="rotate(-90.6)"
          />
        </g>
        <text textAnchor="middle" y={-10} fontFamily={T.mono} fontWeight={800} fontSize={150} fill={T.amber} opacity={slice}>
          1%
        </text>
        <text textAnchor="middle" y={70} fontFamily={T.mono} fontSize={46} fill={T.text} opacity={counter}>
          = ${fmt(100 * counter)} at risk
        </text>
      </g>
      <Tag x={540} y={1060} text={`$${fmt(9900)} SAFE`} color={T.green} s={useSpringAt(50, 12)} />
    </Stage>
  );
};

// ------------------------------------------------------------------ drawdown
/** 10 straight losses: 1% risk keeps 90.4%, 10% risk keeps 34.9%. */
export const Drawdown: React.FC<P> = ({ frames }) => {
  const frame = useCurrentFrame();
  const steps = interpolate(frame, [10, frames * 0.7], [0, 10], clamp);
  const x = (k: number) => 140 + k * 84;
  const y = scale(0, 100, 260, 1000);
  const path = (risk: number) => {
    let d = `M${x(0)},${y(100)}`;
    for (let k = 1; k <= Math.floor(steps); k++) {
      d += ` H${x(k)} V${y(100 * (1 - risk) ** k)}`;
    }
    const frac = steps - Math.floor(steps);
    const k = Math.floor(steps);
    if (k < 10) d += ` H${x(k) + 84 * frac}`;
    return d;
  };
  const end1 = 100 * 0.99 ** steps;
  const end10 = 100 * 0.9 ** steps;
  return (
    <Stage>
      <Heading text="10 LOSSES IN A ROW" sub="same trades · different size" y={120} />
      <ChartGrid top={260} bottom={1000} x0={140} x1={980} rows={4} />
      {[100, 75, 50, 25, 0].map((v) => (
        <text key={v} x={120} y={y(v) + 10} textAnchor="end" fontFamily={T.mono} fontSize={26} fill={T.muted}>
          {v}%
        </text>
      ))}
      <path d={path(0.01)} fill="none" stroke={T.green} strokeWidth={10} strokeLinejoin="round" />
      <path d={path(0.1)} fill="none" stroke={T.red} strokeWidth={10} strokeLinejoin="round" />
      <Tag x={Math.min(x(steps), 860)} y={y(end1) - 50} text={`1% RISK ${fmt(end1, 1)}%`} color={T.green} size={30} />
      <Tag x={Math.min(x(steps), 840)} y={y(end10) + 70} text={`10% RISK ${fmt(end10, 1)}%`} color={T.red} size={30} />
      <text x={540} y={1080} textAnchor="middle" fontFamily={T.mono} fontSize={30} fill={T.muted} opacity={useRamp(frames * 0.7, frames * 0.8)}>
        0.99¹⁰ = 0.904 · 0.90¹⁰ = 0.349
      </text>
    </Stage>
  );
};

// ------------------------------------------------------------------ stop loss
const STOP = makeCandles("stop", 26, 100, (i) => (i < 8 ? 0.2 : i < 14 ? -1.6 : -2.6), 1.4);

/** Rule 2: entry + stop are drawn first; price later tags the stop and keeps falling. */
export const StopLoss: React.FC<P> = ({ frames }) => {
  const frame = useCurrentFrame();
  const lines = useRamp(0, 14);
  const shown = interpolate(frame, [18, frames * 0.85], [0, STOP.length], clamp);
  const y = scale(55, 108, 260, 1000);
  const entry = STOP[0].o;
  const stop = entry - 6;
  const hitIndex = STOP.findIndex((k) => k.l <= stop);
  const hit = hitIndex >= 0 && shown > hitIndex + 1;
  const hitS = useSpringAt(Math.round(18 + ((hitIndex + 1) / STOP.length) * (frames * 0.85 - 18)), 10);
  const avoidedS = useSpringAt(Math.round(frames * 0.8), 12);
  const stepW = 920 / STOP.length;
  return (
    <Stage>
      <Heading text="STOP FIRST, THEN ENTER" sub="decide the exit while you're calm" y={120} />
      <ChartGrid top={260} bottom={1000} />
      <line x1={80} x2={80 + 920 * lines} y1={y(entry)} y2={y(entry)} stroke={T.text} strokeWidth={4} strokeDasharray="16 12" />
      <line x1={80} x2={80 + 920 * lines} y1={y(stop)} y2={y(stop)} stroke={T.red} strokeWidth={5} strokeDasharray="16 12" />
      <text x={990} y={y(entry) - 16} textAnchor="end" fontFamily={T.mono} fontSize={30} fill={T.text} opacity={lines}>
        ENTRY
      </text>
      <text x={990} y={y(stop) - 16} textAnchor="end" fontFamily={T.mono} fontSize={30} fill={T.red} opacity={lines}>
        STOP −1R
      </text>
      {/* candles after the stop are "what you avoided", faded */}
      <g opacity={hit ? 0.35 : 1}>
        <Candles data={STOP} shown={shown} x0={80} width={920} y={y} />
      </g>
      {hit ? (
        <g>
          <Candles data={STOP.slice(0, hitIndex + 1)} shown={hitIndex + 1} x0={80} width={stepW * (hitIndex + 1)} y={y} />
          <circle cx={80 + stepW * (hitIndex + 0.5)} cy={y(stop)} r={26 * hitS} fill="none" stroke={T.amber} strokeWidth={6} />
          <Tag x={80 + stepW * (hitIndex + 0.5)} y={y(stop) + 90} text="OUT −1%" color={T.amber} s={hitS} />
          <Tag x={760} y={960} text="NOT −20%" color={T.red} s={avoidedS} size={30} />
        </g>
      ) : null}
    </Stage>
  );
};

// ------------------------------------------------------------------ risk:reward
const RR = makeCandles("rr", 22, 100, (i) => (i < 5 ? -0.6 : 1.25), 1.2);

/** Rule 3: long-position tool, 1R risk box under 2R reward box; price runs to target. */
export const RiskReward: React.FC<P> = ({ frames }) => {
  const frame = useCurrentFrame();
  const boxes = useSpringAt(0, 14);
  const shown = interpolate(frame, [16, frames * 0.85], [0, RR.length], clamp);
  const y = scale(90, 117, 260, 1000);
  const entry = 100;
  const stop = entry - 6;
  const target = entry + 12;
  const hitIndex = RR.findIndex((k) => k.h >= target);
  const done = hitIndex >= 0 && shown > hitIndex + 1;
  const doneS = useSpringAt(Math.round(16 + ((hitIndex + 1) / RR.length) * (frames * 0.85 - 16)), 10);
  const x0 = 120;
  const w = 840 * boxes;
  return (
    <Stage>
      <Heading text="RISK 1 TO MAKE 2" sub="minimum reward : risk = 2 : 1" y={120} />
      <rect x={x0} y={y(target)} width={w} height={y(entry) - y(target)} fill={T.green} opacity={0.18} />
      <rect x={x0} y={y(entry)} width={w} height={y(stop) - y(entry)} fill={T.red} opacity={0.2} />
      <line x1={x0} x2={x0 + w} y1={y(entry)} y2={y(entry)} stroke={T.text} strokeWidth={3} />
      <text x={x0 + 24} y={y(target) + 56} fontFamily={T.mono} fontWeight={800} fontSize={44} fill={T.green} opacity={boxes}>
        +2R REWARD
      </text>
      <text x={x0 + 840 - 24} y={y(stop) - 24} textAnchor="end" fontFamily={T.mono} fontWeight={800} fontSize={40} fill={T.red} opacity={boxes}>
        −1R RISK
      </text>
      <Candles data={RR} shown={shown} x0={x0} width={840} y={y} />
      {done ? <Tag x={540} y={y(target) - 60} text="TARGET HIT +2R" color={T.green} s={doneS} /> : null}
    </Stage>
  );
};

// ------------------------------------------------------------------ win rate
const OUTCOMES = ["L", "W", "L", "L", "W", "L", "W", "L", "L", "W"] as const; // 4 wins, 6 losses

/** Interrupt + payoff: 10 trades flip over; 40% win rate at 2R still ends +2R. */
export const WinRate: React.FC<P> = ({ frames }) => {
  const frame = useCurrentFrame();
  const start = Math.round(frames * 0.3); // hushed beat first, then the reveal
  const per = (frames * 0.55) / OUTCOMES.length;
  const revealed = OUTCOMES.filter((_, i) => frame >= start + i * per).length;
  const total = OUTCOMES.slice(0, revealed).reduce((sum, o) => sum + (o === "W" ? 2 : -1), 0);
  const finalS = useSpringAt(Math.round(start + OUTCOMES.length * per + 6), 9);
  const intro = useSpringAt(0, 16);
  return (
    <Stage>
      <g opacity={intro}>
        <text x={540} y={140} textAnchor="middle" fontFamily={T.sans} fontWeight={900} fontSize={60} fill={T.text}>
          WIN RATE: 40%
        </text>
        <text x={540} y={196} textAnchor="middle" fontFamily={T.mono} fontSize={30} fill={T.muted}>
          wins pay +2R · losses cost −1R
        </text>
      </g>
      {OUTCOMES.map((o, i) => {
        const col = i % 5;
        const row = Math.floor(i / 5);
        const cx = 150 + col * 195;
        const cy = 360 + row * 230;
        const flip = interpolate(frame, [start + i * per, start + i * per + 8], [0, 1], clamp);
        const shownFace = flip > 0.5;
        const color = o === "W" ? T.green : T.red;
        return (
          <g key={i} transform={`translate(${cx} ${cy}) scale(${Math.abs(1 - 2 * flip) || 0.02} 1)`}>
            <rect x={-80} y={-90} width={160} height={180} rx={20} fill={shownFace ? color : T.bg2} stroke={shownFace ? color : T.grid} strokeWidth={4} opacity={shownFace ? 0.9 : 1} />
            <text textAnchor="middle" y={shownFace ? 22 : 18} fontFamily={T.mono} fontWeight={800} fontSize={shownFace ? 58 : 50} fill={shownFace ? T.bg : T.muted}>
              {shownFace ? (o === "W" ? "+2R" : "−1R") : `#${i + 1}`}
            </text>
          </g>
        );
      })}
      <g transform="translate(540 960)">
        <text textAnchor="middle" fontFamily={T.mono} fontSize={40} fill={T.muted}>
          RUNNING TOTAL
        </text>
        <text
          textAnchor="middle"
          y={120 + (1 - finalS) * 0}
          fontFamily={T.mono}
          fontWeight={800}
          fontSize={120 + 40 * finalS}
          fill={total > 0 ? T.green : total < 0 ? T.red : T.text}
        >
          {total > 0 ? "+" : total < 0 ? "−" : ""}
          {Math.abs(total)}R
        </text>
      </g>
    </Stage>
  );
};

// ------------------------------------------------------------------ title
/** Close / loop: the three rules as a checklist over a rising equity line. */
export const Title: React.FC<P> = () => {
  const frame = useCurrentFrame();
  const line = useRamp(0, 40);
  const pts = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    const v = 980 - t * 620 - Math.sin(i * 1.3) * 26 - Math.sin(i * 0.4) * 30;
    return `${80 + t * 920},${v}`;
  });
  const visible = Math.max(2, Math.round(41 * line));
  const rules = ["1% RISK PER TRADE", "STOP BEFORE ENTRY", "MIN 2:1 REWARD"];
  const save = useSpringAt(40, 8);
  const pulse = 1 + 0.05 * Math.sin(frame / 5);
  return (
    <Stage>
      <polyline points={pts.slice(0, visible).join(" ")} fill="none" stroke={T.green} strokeOpacity={0.35} strokeWidth={12} strokeLinejoin="round" />
      <text x={540} y={210} textAnchor="middle" fontFamily={T.sans} fontWeight={900} fontSize={140} fill={T.text} opacity={useSpringAt(0)}>
        RISK FIRST
      </text>
      {rules.map((r, i) => {
        const s = useSpringAt(10 + i * 7, 13);
        return (
          <g key={r} opacity={s} transform={`translate(${200 - (1 - s) * 60} ${400 + i * 140})`}>
            <rect x={0} y={-56} width={84} height={84} rx={18} fill={T.green} />
            <path d="M18,-14 L36,6 L68,-34" stroke={T.bg} strokeWidth={12} fill="none" strokeLinecap="round" strokeLinejoin="round" />
            <text x={120} y={0} fontFamily={T.sans} fontWeight={800} fontSize={58} fill={T.text}>
              {r}
            </text>
          </g>
        );
      })}
      <g transform={`translate(540 960) scale(${save * pulse})`} opacity={save}>
        <rect x={-280} y={-62} width={560} height={124} rx={62} fill={T.amber} />
        <path d="M-220,-34 h44 v70 l-22,-16 l-22,16 z" fill={T.bg} />
        <text x={40} y={20} textAnchor="middle" fontFamily={T.sans} fontWeight={900} fontSize={58} fill={T.bg}>
          SAVE THIS
        </text>
      </g>
    </Stage>
  );
};

export const TRADING_VISUALS: Record<string, React.FC<P>> = {
  crash: Crash,
  risk: Risk,
  drawdown: Drawdown,
  stoploss: StopLoss,
  rr: RiskReward,
  winrate: WinRate,
  title: Title,
};
