import { Easing, interpolate } from "remotion";
import timeline from "./timeline.json";

export type TEvent = { at: number; type: string; x?: number; y?: number; x2?: number; y2?: number; dur?: number; char?: string; field?: string; row?: number; line?: number };
export type Scene = {
  id: string;
  startBar: number;
  bars: number;
  camera: number[][];
  events: TEvent[];
  caption?: { n: string; label: string; headline: string; line: string };
};

export const T = timeline as unknown as { fps: number; bpm: number; barFrames: number; totalBars: number; scenes: Scene[] };
export const FPS = T.fps;
export const BAR = T.barFrames;
export const TOTAL = T.totalBars * BAR;
export const SCENES = T.scenes.map((s) => ({ ...s, from: s.startBar * BAR, dur: s.bars * BAR }));
export const scene = (id: string) => SCENES.find((s) => s.id === id)!;

/** The house curve: quick start, soft landing. */
export const ease = Easing.bezier(0.65, 0, 0.35, 1);
export const out = Easing.bezier(0.22, 1, 0.36, 1);

/** Value between frames a and b, eased, clamped. */
export const tween = (f: number, a: number, b: number, from = 0, to = 1, e = out) =>
  interpolate(f, [a, b], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: e });

/** Interpolates camera keyframes [frame, zoom, x, y]. */
export function cameraAt(keys: number[][], f: number) {
  if (keys.length === 1) return { z: keys[0][1], x: keys[0][2], y: keys[0][3] };
  const frames = keys.map((k) => k[0]);
  const pick = (i: number) => interpolate(f, frames, keys.map((k) => k[i]), { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return { z: pick(1), x: pick(2), y: pick(3) };
}

/** Example data (all from the made-up sample customer "Sarah" in the app). */
export const DATA = {
  name: "Sarah",
  income: 450_000,
  spending: 280_000,
  left: 170_000,
  goal: 1_000_000,
  months: 12,
  monthly: 83_333,
  score: 95,
  salary: 450_000,
};

export const naira = (n: number) => "₦" + Math.round(n).toLocaleString("en-NG");

/** Month label counted from October 2026, the app's "now" in the sample data. */
export const monthLabel = (m: number) => {
  const d = new Date(2026, 9 + m, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
};
