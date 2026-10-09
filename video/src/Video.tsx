import type { ReactNode } from "react";
import { AbsoluteFill, Audio, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, MIDNIGHT_BG, MONO, SANS, SERIF, useBrandFonts } from "./theme";
import { BAR, SCENES, cameraAt, ease, scene, tween, type Scene } from "./lib";
import { LogoMark, Wordmark } from "./components/brand";
import { SCREEN_H, SCREEN_W, Touches } from "./components/ui";
import { GoalScreen } from "./screens/GoalScreen";
import { PermissionsScreen } from "./screens/PermissionsScreen";
import { ReadingScreen } from "./screens/ReadingScreen";
import { MatchScreen } from "./screens/MatchScreen";
import { NotifyScreen } from "./screens/NotifyScreen";
import { RouteScreen } from "./screens/RouteScreen";

export type Layout = "landscape" | "portrait";
const BEZEL = 13;
const T_HALF = 7; // screen transitions run 7 frames either side of each bar line

type S = (typeof SCENES)[number];
const SCREENS: Record<string, (p: { f: number; s: S }) => ReactNode> = {
  cover: ({ s }) => <RouteScreen f={999} events={s.events} still />,
  goal: ({ f, s }) => <GoalScreen f={f} events={s.events} />,
  permissions: ({ f, s }) => <PermissionsScreen f={f} events={s.events} />,
  reading: ({ f, s }) => <ReadingScreen f={f} events={s.events} />,
  match: ({ f, s }) => <MatchScreen f={f} events={s.events} />,
  notify: ({ f, s }) => <NotifyScreen f={f} events={s.events} />,
  route: ({ f, s }) => <RouteScreen f={f} events={s.events} />,
};

function geometry(layout: Layout, w: number, h: number) {
  if (layout === "landscape") {
    const s = 1.04;
    return { s, cx: w * 0.69, cy: h * 0.5, tilt: 1 };
  }
  const s = 1.46;
  return { s, cx: w * 0.5, cy: h * 0.655, tilt: 0 };
}

export function Video({ layout }: { layout: Layout }) {
  useBrandFonts();
  const g = useCurrentFrame();
  const { width: W, height: H } = useVideoConfig();
  const geo = geometry(layout, W, H);
  const idx = Math.max(0, SCENES.findIndex((s, i) => g >= s.from && (i === SCENES.length - 1 || g < SCENES[i + 1].from)));
  const cur = SCENES[idx];
  const local = g - cur.from;
  const close = scene("close");

  // ---- camera ----
  const raw = cameraAt(cur.camera, local);
  // Vertical frames have less room: push in more gently there.
  const cam = layout === "portrait" ? { ...raw, z: 1 + (raw.z - 1) * 0.6 } : raw;
  const pw = (SCREEN_W + BEZEL * 2) * geo.s;
  const ph = (SCREEN_H + BEZEL * 2) * geo.s;
  const fx = (BEZEL + cam.x) * geo.s;
  const fy = (BEZEL + cam.y) * geo.s;
  // Push in around the focus point, and drift it toward the middle of the frame as we go.
  const pull = (cam.z - 1) * 0.55;
  const dx = (pw / 2 - fx) * pull;
  let dy = (ph / 2 - fy) * pull * (layout === "portrait" ? 0.6 : 1);
  if (layout === "portrait") {
    // Never let the phone rise into the caption area.
    const top = geo.cy - ph / 2 + fy * (1 - cam.z) + dy;
    const minTop = H * 0.245;
    if (top < minTop) dy += minTop - top;
  }
  const tiltY = geo.tilt ? -9 * Math.max(0, 1 - (cam.z - 1) / 0.3) : 0;
  const buzz = cur.id === "notify" ? Math.sin(local * 2.6) * 5 * tween(local, 18, 20) * (1 - tween(local, 20, 30)) : 0;
  const exit = tween(g, close.from - 2, close.from + 18, 0, 1, ease);
  const enterPhone = 1; // frame 0 is the finished cover: the phone is already in place

  // ---- screens (with a slide on every bar-line cut) ----
  const layers: ReactNode[] = [];
  SCENES.forEach((s, i) => {
    if (!SCREENS[s.id]) return;
    const startT = i === 0 ? -Infinity : s.from - T_HALF;
    const next = SCENES[i + 1];
    const endT = next && SCREENS[next.id] ? next.from + T_HALF : next ? next.from + 20 : Infinity;
    if (g < startT || g >= endT) return;
    const pin = i === 0 ? 1 : tween(g, s.from - T_HALF, s.from + T_HALF, 0, 1, ease);
    const pout = next && SCREENS[next.id] ? tween(g, next.from - T_HALF, next.from + T_HALF, 0, 1, ease) : 0;
    const xShift = (1 - pin) * SCREEN_W - pout * SCREEN_W * 0.35;
    layers.push(
      <div key={s.id} style={{ position: "absolute", inset: 0, transform: `translateX(${xShift}px)`, zIndex: i, boxShadow: pin < 1 ? "-20px 0 40px rgba(7,18,38,.25)" : undefined, filter: pout > 0 ? `brightness(${1 - pout * 0.35})` : undefined }}>
        {SCREENS[s.id]({ f: g - s.from, s })}
        <Touches events={s.events} f={g - s.from} />
      </div>,
    );
  });

  const phone = (
    <div
      style={{
        position: "absolute",
        left: geo.cx - pw / 2,
        top: geo.cy - ph / 2,
        width: pw,
        height: ph,
        transformOrigin: `${fx}px ${fy}px`,
        transform: `perspective(2400px) translate(${dx + buzz}px, ${dy + exit * 140}px) rotateY(${tiltY}deg) scale(${cam.z * (1 - exit * 0.18) * enterPhone})`,
        opacity: 1 - exit,
      }}
    >
      <div style={{ position: "absolute", inset: 0, transform: `scale(${geo.s})`, transformOrigin: "0 0", width: SCREEN_W + BEZEL * 2, height: SCREEN_H + BEZEL * 2 }}>
        {/* Device: titanium edge, black bezel, rounded screen, island. */}
        <div style={{ position: "absolute", inset: 0, borderRadius: 64, background: "linear-gradient(145deg,#3a4458,#121a2a 40%,#2a3346)", boxShadow: "0 60px 120px -40px rgba(0,0,0,.85), 0 0 0 1px rgba(255,255,255,.08) inset" }} />
        <div style={{ position: "absolute", inset: 3, borderRadius: 61, background: "#05080f" }} />
        <div style={{ position: "absolute", left: BEZEL, top: BEZEL, width: SCREEN_W, height: SCREEN_H, borderRadius: 52, overflow: "hidden", background: C.canvas }}>
          {layers}
          <div style={{ position: "absolute", left: SCREEN_W / 2 - 62, top: 11, width: 124, height: 36, borderRadius: 18, background: "#000", zIndex: 100 }} />
        </div>
      </div>
    </div>
  );

  return (
    <AbsoluteFill style={{ background: C.night, fontFamily: SANS, overflow: "hidden" }}>
      <Backdrop g={g} layout={layout} camZ={cam.z} />
      {phone}
      {layout === "portrait" && <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: H * 0.3, background: "linear-gradient(180deg, rgba(7,18,38,.92) 0%, rgba(7,18,38,.75) 70%, rgba(7,18,38,0) 100%)", zIndex: 5 }} />}
      <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
      <Cover g={g} layout={layout} />
      {SCENES.filter((s) => s.caption).map((s) => <Caption key={s.id} s={s as S} g={g} layout={layout} />)}
      <Close g={g} layout={layout} />
      </div>
      <Audio src={staticFile("soundtrack.wav")} />
    </AbsoluteFill>
  );
}

function Backdrop({ g, layout, camZ }: { g: number; layout: Layout; camZ: number }) {
  const { width: W, height: H } = useVideoConfig();
  const rot = g * 0.03;
  const zoom = 1 + (camZ - 1) * 0.12;
  return (
    <AbsoluteFill style={{ background: MIDNIGHT_BG }}>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0, transform: `scale(${zoom}) rotate(${rot * 0.15}deg)`, transformOrigin: layout === "landscape" ? "70% 40%" : "50% 60%" }}>
        <g fill="none" stroke="#fff" strokeOpacity="0.05" strokeWidth="1.5">
          {Array.from({ length: 12 }, (_, k) => {
            const cx = layout === "landscape" ? W * 0.72 : W * 0.55;
            const cy = layout === "landscape" ? H * 0.35 : H * 0.45;
            const r = 70 + k * 72;
            const pts = Array.from({ length: 64 }, (_, i) => {
              const a = (i / 64) * Math.PI * 2;
              const w = 1 + 0.12 * Math.sin(3 * a + k * 0.5 + g * 0.004) + 0.06 * Math.sin(5 * a - k);
              return `${(cx + Math.cos(a) * r * w * 1.35).toFixed(1)},${(cy + Math.sin(a) * r * w).toFixed(1)}`;
            });
            return <polygon key={k} points={pts.join(" ")} />;
          })}
        </g>
      </svg>
      <div style={{ position: "absolute", width: 900, height: 900, borderRadius: 450, background: "rgba(46,230,168,.10)", filter: "blur(120px)", left: (layout === "landscape" ? W * 0.62 : W * 0.2) + Math.sin(g / 90) * 60, top: -300 + Math.cos(g / 110) * 40 }} />
      <div style={{ position: "absolute", width: 800, height: 800, borderRadius: 400, background: "rgba(47,107,255,.14)", filter: "blur(120px)", left: -250 + Math.cos(g / 100) * 50, top: H - 500 }} />
    </AbsoluteFill>
  );
}

/** Opening: logo + tagline. Fully drawn on frame 0 so the first frame works as the thumbnail. */
function Cover({ g, layout }: { g: number; layout: Layout }) {
  const c = scene("cover");
  const outP = tween(g, c.from + c.dur - 16, c.from + c.dur + 4, 0, 1, ease);
  if (outP >= 1) return null;
  const land = layout === "landscape";
  return (
    <div style={{ position: "absolute", left: land ? 130 : 80, top: land ? 0 : 96, width: land ? 760 : 920, height: land ? "100%" : "auto", display: "flex", flexDirection: "column", justifyContent: land ? "center" : "flex-start", opacity: 1 - outP, transform: `translateX(${-outP * 60}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
        <LogoMark size={land ? 84 : 92} />
        <Wordmark size={land ? 46 : 52} dark />
      </div>
      <p style={{ margin: land ? "56px 0 0" : "44px 0 0", fontFamily: MONO, fontSize: land ? 22 : 26, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,.6)" }}>Smart product matching for Zenith Bank</p>
      <h1 style={{ margin: "18px 0 0", fontFamily: SANS, fontWeight: 600, fontSize: land ? 104 : 94, lineHeight: 1.0, letterSpacing: "-0.045em", color: "#fff" }}>
        Your money, <span style={{ fontFamily: SERIF, fontStyle: "italic", fontWeight: 400, color: C.mint, letterSpacing: "-0.01em" }}>mapped.</span>
        <br />One right move.
      </h1>
    </div>
  );
}

/** Step caption: number, label, headline, one supporting line. */
function Caption({ s, g, layout }: { s: S & Scene; g: number; layout: Layout }) {
  const l = g - s.from;
  if (l < -10 || l > s.dur + 10) return null;
  const inP = tween(l, 0, 16, 0, 1);
  const outP = tween(l, s.dur - 12, s.dur + 2, 0, 1, ease);
  const vis = inP * (1 - outP);
  if (vis <= 0) return null;
  const c = s.caption!;
  const land = layout === "landscape";
  const words = c.headline.split(" ");
  return (
    <div style={{ position: "absolute", left: land ? 130 : 80, top: land ? 0 : 96, width: land ? 720 : 920, height: land ? "100%" : "auto", display: "flex", flexDirection: "column", justifyContent: land ? "center" : "flex-start", opacity: vis, transform: `translateX(${(1 - inP) * -40 + outP * -30}px)` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <span style={{ fontFamily: MONO, fontSize: land ? 30 : 34, fontWeight: 500, color: C.night, background: C.mint, borderRadius: 14, padding: "6px 14px" }}>{c.n}</span>
        <span style={{ fontFamily: SANS, fontSize: land ? 28 : 32, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: "rgba(255,255,255,.7)" }}>{c.label}</span>
      </div>
      <h2 style={{ margin: land ? "30px 0 0" : "26px 0 0", fontFamily: SANS, fontWeight: 600, fontSize: land ? 84 : 76, lineHeight: 1.02, letterSpacing: "-0.04em", color: "#fff" }}>
        {words.map((w, i) => {
          const wp = tween(l, 3 + i * 2.5, 15 + i * 2.5);
          return <span key={i} style={{ display: "inline-block", marginRight: "0.24em", opacity: wp, transform: `translateY(${(1 - wp) * 26}px)` }}>{w}</span>;
        })}
      </h2>
      <p style={{ margin: land ? "26px 0 0" : "22px 0 0", fontFamily: SANS, fontSize: land ? 38 : 36, lineHeight: 1.3, color: "rgba(255,255,255,.72)", opacity: tween(l, 12, 26) }}>{c.line}</p>
      <div style={{ marginTop: land ? 40 : 22, display: "flex", gap: 10 }}>
        {SCENES.filter((x) => x.caption).map((x) => (
          <span key={x.id} style={{ height: 6, width: x.id === s.id ? 54 : 18, borderRadius: 3, background: x.id === s.id ? C.mint : "rgba(255,255,255,.2)" }} />
        ))}
      </div>
    </div>
  );
}

/** Closing: the logo draws itself, three words, and the call to action. */
function Close({ g, layout }: { g: number; layout: Layout }) {
  const c = scene("close");
  const l = g - c.from;
  if (l < 0) return null;
  const land = layout === "landscape";
  const draw = tween(l, 4, 30, 0, 1, ease);
  const words = ["Read.", "Match.", "Explain."];
  const cta = tween(l, 30, 44);
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", flexDirection: "column", opacity: tween(l, 0, 8) }}>
      <div style={{ display: "flex", alignItems: "center", gap: 26, transform: `scale(${0.9 + 0.1 * tween(l, 0, 20)})` }}>
        <LogoMark size={land ? 130 : 150} draw={draw} />
        <Wordmark size={land ? 76 : 84} dark style={{ opacity: tween(l, 8, 20) }} />
      </div>
      <p style={{ margin: land ? "46px 0 0" : "56px 0 0", display: "flex", gap: "0.35em", fontFamily: SERIF, fontStyle: "italic", fontSize: land ? 82 : 96, color: "#fff", letterSpacing: "-0.01em" }}>
        {words.map((w, i) => {
          const p = tween(l, 14 + i * 6, 26 + i * 6);
          return <span key={w} style={{ opacity: p, transform: `translateY(${(1 - p) * 24}px)`, color: i === 2 ? C.mint : "#fff" }}>{w}</span>;
        })}
      </p>
      <div style={{ marginTop: land ? 54 : 70, display: "flex", flexDirection: "column", alignItems: "center", gap: 18, opacity: cta, transform: `translateY(${(1 - cta) * 20}px)` }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 14, height: land ? 84 : 96, padding: land ? "0 44px" : "0 50px", borderRadius: 24, background: C.mint, color: C.night, fontFamily: SANS, fontWeight: 600, fontSize: land ? 38 : 44, boxShadow: "0 20px 50px -18px rgba(46,230,168,.9)" }}>
          Try the live demo
          <svg width="34" height="34" viewBox="0 0 24 24"><circle cx="4.5" cy="12" r="1.8" fill={C.night} /><path d="M8 12h11M14 7l5 5-5 5" fill="none" stroke={C.night} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span style={{ fontFamily: MONO, fontSize: land ? 32 : 38, color: "rgba(255,255,255,.8)" }}>moneymap-kuld.onrender.com</span>
      </div>
    </AbsoluteFill>
  );
}

export const DURATION = BAR * 20;
