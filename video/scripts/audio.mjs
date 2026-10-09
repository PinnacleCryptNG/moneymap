// Writes public/soundtrack.wav: an original 120 BPM track plus every interface sound.
// Everything is synthesised here, so there is nothing to license. Sound effects are placed
// from src/timeline.json — the same file that times the visuals — so they cannot drift.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const T = JSON.parse(readFileSync(new URL("../src/timeline.json", import.meta.url)));
const SR = 48000;
const FPS = T.fps;
const BAR = (60 / T.bpm) * 4; // seconds per bar (2 s at 120 BPM)
const BEAT = BAR / 4;
const DUR = T.totalBars * BAR;
const N = Math.round(DUR * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);

// ---------- helpers ----------
let seed = 7;
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
function add(t0, len, fn, gain = 1, pan = 0) {
  const s0 = Math.round(t0 * SR);
  const n = Math.round(len * SR);
  const gl = gain * Math.cos(((pan + 1) * Math.PI) / 4);
  const gr = gain * Math.sin(((pan + 1) * Math.PI) / 4);
  for (let i = 0; i < n; i++) {
    const k = s0 + i;
    if (k < 0 || k >= N) continue;
    const v = fn(i / SR, i);
    L[k] += v * gl;
    R[k] += v * gr;
  }
}
const env = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) / d));

// ---------- music ----------
// Am – F – C – G, closing G → C. Each chord: [bass midi, triad midis]
const CH = {
  Am: [45, [57, 60, 64]],
  F: [41, [57, 60, 65]],
  C: [48, [55, 60, 64]],
  G: [43, [55, 59, 62]],
};
const prog = ["Am", "F", "C", "G"];
const chordAt = (bar) => (bar === 18 ? "G" : bar === 19 ? "C" : prog[bar % 4]);

// Section shape by bar: cover 0–1 (intro), 2–12 full, 13–14 breakdown, 15–17 full+, 18–19 outro.
const section = (bar) => (bar < 2 ? "intro" : bar < 13 ? "full" : bar < 15 ? "break" : bar < 18 ? "lift" : "outro");

function kick(t, g) {
  add(t, 0.35, (x) => {
    const f = 45 + 95 * Math.exp(-x * 28);
    return Math.sin(2 * Math.PI * f * x - 0) * Math.exp(-x * 9);
  }, g);
}
function snare(t, g) {
  let lp = 0;
  add(t, 0.22, (x) => {
    const n = rand();
    lp += 0.5 * (n - lp);
    return ((n - lp) * 0.8 * Math.exp(-x * 22) + Math.sin(2 * Math.PI * 190 * x) * 0.4 * Math.exp(-x * 30));
  }, g, 0.05);
}
function hat(t, g, pan = 0.25) {
  let prev = 0;
  add(t, 0.05, (x) => {
    const n = rand();
    const hp = n - prev;
    prev = n;
    return hp * Math.exp(-x * 90);
  }, g, pan);
}
function bass(t, m, len, g) {
  const f = midi(m);
  let lp = 0;
  add(t, len, (x) => {
    const saw = 2 * ((f * x) % 1) - 1;
    lp += 0.06 * (saw - lp);
    const e = Math.min(1, x / 0.01) * Math.min(1, (len - x) / 0.05);
    return (lp * 0.9 + Math.sin(2 * Math.PI * f * x) * 0.6) * e;
  }, g);
}
function pad(t, notes, len, g) {
  notes.forEach((m, i) => {
    const f = midi(m);
    let lp = 0;
    add(t, len + 0.6, (x) => {
      const det = 1 + (i - 1) * 0.0025;
      const s = (2 * ((f * det * x) % 1) - 1) * 0.5 + (2 * ((f * 1.004 * x) % 1) - 1) * 0.5;
      lp += 0.035 * (s - lp);
      const a = Math.min(1, x / 0.35);
      const r = x > len ? Math.max(0, 1 - (x - len) / 0.6) : 1;
      return lp * a * r;
    }, g, (i - 1) * 0.35);
  });
}
function pluck(t, m, g, pan) {
  const f = midi(m);
  add(t, 0.4, (x) => {
    const s = Math.sin(2 * Math.PI * f * x) + 0.35 * Math.sin(4 * Math.PI * f * x) + 0.12 * Math.sin(6 * Math.PI * f * x);
    return s * Math.exp(-x * 11) * Math.min(1, x / 0.004);
  }, g, pan);
}
function bell(t, m, g, pan = 0, decay = 0.9) {
  const f = midi(m);
  add(t, decay * 3, (x) => {
    const s = Math.sin(2 * Math.PI * f * x) + 0.5 * Math.sin(2 * Math.PI * f * 2.76 * x) * Math.exp(-x * 5) + 0.25 * Math.sin(2 * Math.PI * f * 5.4 * x) * Math.exp(-x * 9);
    return s * Math.exp(-x / decay) * Math.min(1, x / 0.003);
  }, g, pan);
}

const MUSIC = 0.16;
for (let bar = 0; bar < T.totalBars; bar++) {
  const t0 = bar * BAR;
  const sec = section(bar);
  const [b, triad] = CH[chordAt(bar)];
  // Pad always; brighter in lift.
  pad(t0, triad.map((m) => m + (sec === "lift" ? 12 : 0)), BAR, MUSIC * (sec === "intro" ? 0.55 : 0.42));
  if (sec === "outro") {
    if (bar === 18) for (let q = 0; q < 4; q++) kick(t0 + q * BEAT, MUSIC * 1.4);
    if (bar === 19) { kick(t0, MUSIC * 1.5); bass(t0, b, BAR * 0.9, MUSIC * 0.7); bell(t0, 72, MUSIC * 0.5, -0.2, 1.4); bell(t0 + 0.12, 76, MUSIC * 0.45, 0.2, 1.4); bell(t0 + 0.24, 79, MUSIC * 0.4, 0, 1.4); }
    else for (let q = 0; q < 4; q++) bass(t0 + q * BEAT, b, BEAT * 0.9, MUSIC * 0.6);
    continue;
  }
  // Arpeggio in 16ths.
  const arp = [triad[0], triad[1], triad[2], triad[1] + 12, triad[2], triad[1], triad[0] + 12, triad[2]];
  for (let s = 0; s < 16; s++) {
    if (sec === "intro" && s % 2) continue;
    const m = arp[s % 8] + 12 + (sec === "lift" ? 12 : 0);
    pluck(t0 + s * (BEAT / 4), m, MUSIC * (sec === "break" ? 0.22 : 0.3), s % 2 ? 0.3 : -0.3);
  }
  if (sec === "intro") {
    if (bar === 1) add(t0, BAR, (x) => rand() * (x / BAR) ** 2 * 0.5, MUSIC * 0.35); // riser into the first scene
    continue;
  }
  // Drums and bass.
  for (let q = 0; q < 4; q++) {
    const tq = t0 + q * BEAT;
    if (sec !== "break") kick(tq, MUSIC * 1.5);
    if (sec !== "break" && (q === 1 || q === 3)) snare(tq, MUSIC * 0.8);
    hat(tq + BEAT / 2, MUSIC * 0.5);
    if (sec !== "break" || q % 2 === 0) bass(tq, b, BEAT * 0.85, MUSIC * 0.75);
  }
  if (bar === 14) for (let s = 0; s < 8; s++) snare(t0 + BAR / 2 + s * (BEAT / 4), MUSIC * (0.2 + s * 0.08)); // roll into the route
}

// ---------- interface sounds, from the timeline ----------
const SFX = 0.55;
function tapS(t) {
  add(t, 0.06, (x) => Math.sin(2 * Math.PI * 1700 * x) * Math.exp(-x * 90) + rand() * 0.4 * Math.exp(-x * 400), SFX * 0.8);
}
function typeS(t, i) {
  const f = 2300 + (i % 3) * 180;
  add(t, 0.035, (x) => (Math.sin(2 * Math.PI * f * x) * 0.5 + rand() * 0.6) * Math.exp(-x * 160), SFX * 0.45, (i % 2 ? 0.15 : -0.15));
}
function toggleS(t, i) {
  const f = 880 * Math.pow(2, i / 12 * 2);
  add(t, 0.09, (x) => Math.sin(2 * Math.PI * (f + 500 * Math.min(1, x / 0.03)) * x) * Math.exp(-x * 40), SFX * 0.45);
}
function popS(t) {
  add(t, 0.12, (x) => Math.sin(2 * Math.PI * (520 + 300 * Math.exp(-x * 40)) * x) * Math.exp(-x * 30), SFX * 0.5);
}
function riseS(t, dur) {
  add(t, dur, (x) => {
    const p = x / dur;
    const f = 380 + 520 * p * p;
    return Math.sin(2 * Math.PI * f * x) * 0.5 * Math.min(1, x / 0.05) * (1 - p * 0.4);
  }, SFX * 0.25);
}
function chimeS(t) {
  [72, 76, 79, 84].forEach((m, i) => bell(t + i * 0.07, m, SFX * 0.3, (i - 1.5) * 0.2, 0.7));
}
function notifyS(t) {
  bell(t, 88, SFX * 0.42, -0.1, 0.5);
  bell(t + 0.13, 95, SFX * 0.38, 0.1, 0.6);
}
function buzzS(t) {
  add(t, 0.32, (x) => Math.sign(Math.sin(2 * Math.PI * 150 * x)) * 0.35 * (Math.sin(2 * Math.PI * 22 * x) > -0.3 ? 1 : 0) * Math.min(1, (0.32 - x) / 0.04), SFX * 0.4);
}
function whooshS(tEnd) {
  const len = 0.42;
  let lp = 0;
  add(tEnd - len * 0.7, len, (x) => {
    const p = x / len;
    const c = 0.03 + 0.25 * Math.sin(Math.PI * p);
    lp += c * (rand() - lp);
    return lp * Math.sin(Math.PI * p) ** 2 * 1.8;
  }, SFX * 0.55);
}
function tickS(t) {
  add(t, 0.02, (x) => Math.sin(2 * Math.PI * 3200 * x) * Math.exp(-x * 300), SFX * 0.25);
}

let typed = 0;
for (const s of T.scenes) {
  const base = (s.startBar * T.barFrames) / FPS;
  if (s.startBar > 0) whooshS(base); // every cut is on a bar line
  for (const e of s.events) {
    const t = base + e.at / FPS;
    if (e.type === "tap") tapS(t);
    else if (e.type === "type") typeS(t, typed++);
    else if (e.type === "toggle") toggleS(t, e.row ?? 0);
    else if (e.type === "pop") popS(t);
    else if (e.type === "rise") riseS(t, e.dur / FPS);
    else if (e.type === "chime") chimeS(t);
    else if (e.type === "notify") notifyS(t);
    else if (e.type === "buzz") buzzS(t);
    else if (e.type === "drag") {
      tapS(t);
      for (let k = 6; k < e.dur; k += 5) tickS(t + k / FPS);
    }
  }
}

// ---------- master: gentle fade-out, soft clip, write 16-bit WAV ----------
const fadeStart = DUR - 1.2;
const buf = Buffer.alloc(44 + N * 4);
buf.write("RIFF", 0); buf.writeUInt32LE(36 + N * 4, 4); buf.write("WAVE", 8);
buf.write("fmt ", 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34);
buf.write("data", 36); buf.writeUInt32LE(N * 4, 40);
// Normalise so the loudest moment sits just under full scale.
let raw = 0;
for (let i = 0; i < N; i++) raw = Math.max(raw, Math.abs(L[i]), Math.abs(R[i]));
const norm = 1.25 / raw;
let peak = 0;
for (let i = 0; i < N; i++) {
  const t = i / SR;
  const f = t > fadeStart ? Math.max(0, 1 - (t - fadeStart) / 1.2) : 1;
  const l = Math.tanh(L[i] * norm) * f * 0.97;
  const r = Math.tanh(R[i] * norm) * f * 0.97;
  peak = Math.max(peak, Math.abs(l), Math.abs(r));
  buf.writeInt16LE(Math.round(l * 32000), 44 + i * 4);
  buf.writeInt16LE(Math.round(r * 32000), 46 + i * 4);
}
mkdirSync(new URL("../public/", import.meta.url), { recursive: true });
writeFileSync(new URL("../public/soundtrack.wav", import.meta.url), buf);
console.log(`soundtrack.wav: ${DUR}s at ${T.bpm} BPM, peak ${peak.toFixed(2)}`);
