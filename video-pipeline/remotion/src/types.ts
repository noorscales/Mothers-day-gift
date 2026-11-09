export type Visual = "roses" | "bouquet" | "bag" | "perfume" | "letter" | "hearts" | "title";

export type Scene = {
  id: string;
  beat: "hook" | "build" | "pattern_interrupt" | "payoff" | "loop";
  visual: Visual;
  emotion: string;
  text: string;
  start: number; // seconds
  end: number;
};

export type Word = {
  index: number;
  text: string;
  line: number;
  emphasis: boolean;
  start: number;
  end: number;
  src: "asr" | "interp" | "estimate";
};

export type Caption = { start: number; end: number; words: number[] };

export type Timeline = {
  fps: number;
  duration: number;
  durationInFrames: number;
  title: string;
  alignment: string;
  scenes: Scene[];
  words: Word[];
  captions: Caption[];
};

export const PALETTE = {
  blush: "#FFB6C1",
  rose: "#FF6B8A",
  hot: "#FF1493",
  crimson: "#DC143C",
  deep: "#8B0000",
  cream: "#FFF0F3",
  white: "#FFFAF9",
  gold: "#E8B04B",
};

export const SERIF = '"Playfair Display", "DejaVu Serif", Georgia, serif';
