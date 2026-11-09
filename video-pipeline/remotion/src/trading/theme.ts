import type { CaptionTheme } from "../Captions";

export const T = {
  bg: "#0B1020",
  bg2: "#111833",
  grid: "#1C2541",
  green: "#22C55E",
  red: "#EF4444",
  amber: "#F5B700",
  text: "#E6EDF7",
  muted: "#8A97B8",
  sans: 'Inter, "DejaVu Sans", Arial, sans-serif',
  mono: '"JetBrains Mono", "DejaVu Sans Mono", monospace',
};

export const TRADING_CAPTIONS: CaptionTheme = {
  font: T.sans,
  weight: 800,
  size: 84,
  top: 1300,
  base: "#C9D3EA",
  active: "#FFFFFF",
  accent: "#FFD54A",
  accentActive: T.amber,
  stroke: "2px rgba(0,0,0,.6)",
  glow: "rgba(245,183,0,.55)",
  shadow: "rgba(0,0,0,.7)",
  italicEmphasis: false,
  uppercase: true,
};
