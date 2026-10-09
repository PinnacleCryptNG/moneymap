import type { CSSProperties, ReactNode } from "react";
import { C, MONO, SANS } from "../theme";
import { tween, type TEvent } from "../lib";
import { Icon, Lockup, LogoMark } from "./brand";

export const SCREEN_W = 390;
export const SCREEN_H = 844;

export function StatusBar({ dark = false }: { dark?: boolean }) {
  const c = dark ? "#fff" : C.ink;
  return (
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 47, background: dark ? "transparent" : C.canvas, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 30px 0 40px", zIndex: 30, color: c, fontFamily: SANS, fontWeight: 600, fontSize: 16 }}>
      <span>9:41</span>
      <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <svg width="18" height="12" viewBox="0 0 18 12">{[0, 1, 2, 3].map((i) => <rect key={i} x={i * 4.5} y={9 - i * 3} width="3" height={3 + i * 3} rx="1" fill={c} />)}</svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5L1 4.6a10 10 0 0 1 14 0z" fill={c} /></svg>
        <svg width="27" height="13" viewBox="0 0 27 13"><rect x="0.5" y="0.5" width="23" height="12" rx="3.5" fill="none" stroke={c} strokeOpacity=".4" /><rect x="2" y="2" width="18" height="9" rx="2" fill={c} /><rect x="24.5" y="4.5" width="2" height="4" rx="1" fill={c} fillOpacity=".4" /></svg>
      </span>
    </div>
  );
}

/** Onboarding header: logo and the four steps (Your goal · Your money · Permissions · Your map). */
export function OnbHeader({ step }: { step: number }) {
  return (
    <div style={{ position: "absolute", top: 47, left: 0, right: 0, height: 56, background: "rgba(243,246,250,0.94)", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", zIndex: 20 }}>
      <Lockup size={28} text={17} />
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {[1, 2, 3, 4].map((i) => (
          <span key={i} style={{ width: i === step ? 22 : 7, height: 7, borderRadius: 4, background: i <= step ? C.mint600 : C.line }} />
        ))}
        <span style={{ marginLeft: 6, fontFamily: SANS, fontSize: 12, fontWeight: 500, color: C.ink3 }}>{step} of 4</span>
      </div>
    </div>
  );
}

/** The signed-in app header: logo, messages bell, avatar. */
export function AppHeader({ badge = 0 }: { badge?: number }) {
  return (
    <div style={{ position: "absolute", top: 47, left: 0, right: 0, height: 56, background: "rgba(255,255,255,0.92)", borderBottom: `1px solid ${C.line}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 16px 0 20px", zIndex: 20 }}>
      <Lockup size={28} text={17} />
      <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ position: "relative", color: C.ink2 }}>
          <Icon name="bell" size={22} />
          {badge > 0 && (
            <span style={{ position: "absolute", top: -5, right: -6, minWidth: 17, height: 17, borderRadius: 9, background: C.red, color: "#fff", fontFamily: SANS, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", transform: `scale(${badge})` }}>1</span>
          )}
        </span>
        <span style={{ width: 32, height: 32, borderRadius: 16, background: C.mint, color: C.night, fontFamily: SANS, fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", justifyContent: "center" }}>S</span>
      </div>
    </div>
  );
}

export function Btn({ children, kind = "primary", style, pressed = 0 }: { children: ReactNode; kind?: "primary" | "secondary"; style?: CSSProperties; pressed?: number }) {
  return (
    <div
      style={{
        height: 50, borderRadius: 13, display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        fontFamily: SANS, fontWeight: 600, fontSize: 16,
        background: kind === "primary" ? C.mint : "rgba(10,22,40,0.06)",
        color: C.night,
        boxShadow: kind === "primary" ? "0 8px 20px -10px rgba(46,230,168,0.9)" : "none",
        transform: `scale(${1 - pressed * 0.04})`,
        filter: pressed ? `brightness(${1 - pressed * 0.08})` : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function Switch({ on }: { on: number }) {
  return (
    <span style={{ width: 46, height: 28, borderRadius: 14, background: on > 0.5 ? C.blue : "#cbd5e1", position: "relative", display: "inline-block", flexShrink: 0, transition: "none" }}>
      <span style={{ position: "absolute", top: 3, left: 3 + on * 18, width: 22, height: 22, borderRadius: 11, background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.25)" }} />
    </span>
  );
}

export const Eyebrow = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => (
  <p style={{ margin: 0, fontFamily: SANS, fontSize: 11.5, fontWeight: 500, letterSpacing: "0.06em", textTransform: "uppercase", color: C.ink3, ...style }}>{children}</p>
);

/** How "pressed" a tap target is at frame f (for the button squash). */
export const pressedAt = (events: TEvent[], f: number, x: number, y: number, r = 60) => {
  const e = events.find((ev) => ev.type === "tap" && Math.abs((ev.x ?? 0) - x) < r && Math.abs((ev.y ?? 0) - y) < 30 && f >= ev.at - 2 && f <= ev.at + 8);
  if (!e) return 0;
  return f <= e.at ? tween(f, e.at - 2, e.at, 0, 1) : tween(f, e.at, e.at + 8, 1, 0);
};

/** Visible fingertip: approaches, presses, ripples. Drags follow their path. */
export function Touches({ events, f }: { events: TEvent[]; f: number }) {
  return (
    <>
      {events.map((e, i) => {
        if (e.type === "tap") {
          if (f < e.at - 9 || f > e.at + 18) return null;
          const approach = tween(f, e.at - 9, e.at, 0, 1);
          const after = tween(f, e.at, e.at + 18, 0, 1);
          const press = f < e.at ? 1.35 - 0.35 * approach : 0.86 + 0.14 * after;
          return (
            <div key={i} style={{ position: "absolute", left: e.x, top: e.y, zIndex: 50, pointerEvents: "none" }}>
              <div style={{ position: "absolute", left: -24, top: -24, width: 48, height: 48, borderRadius: 24, background: "rgba(255,255,255,0.55)", border: "2px solid rgba(7,18,38,0.35)", boxShadow: "0 6px 18px rgba(7,18,38,0.35)", opacity: approach * (1 - after), transform: `scale(${press})` }} />
              {f >= e.at && <div style={{ position: "absolute", left: -24, top: -24, width: 48, height: 48, borderRadius: 24, border: `3px solid ${C.mint}`, opacity: 1 - after, transform: `scale(${1 + after * 1.4})` }} />}
            </div>
          );
        }
        if (e.type === "drag") {
          const end = e.at + (e.dur ?? 30);
          if (f < e.at - 9 || f > end + 14) return null;
          const p = tween(f, e.at, end, 0, 1);
          const x = (e.x ?? 0) + ((e.x2 ?? 0) - (e.x ?? 0)) * p;
          const y = (e.y ?? 0) + ((e.y2 ?? 0) - (e.y ?? 0)) * p;
          const vis = f < e.at ? tween(f, e.at - 9, e.at) : f > end ? 1 - tween(f, end, end + 14) : 1;
          return (
            <div key={i} style={{ position: "absolute", left: x, top: y, zIndex: 50 }}>
              <div style={{ position: "absolute", left: -24, top: -24, width: 48, height: 48, borderRadius: 24, background: "rgba(255,255,255,0.55)", border: "2px solid rgba(7,18,38,0.35)", boxShadow: "0 6px 18px rgba(7,18,38,0.35)", opacity: vis, transform: `scale(${f < e.at ? 1.3 - 0.3 * vis : 0.9})` }} />
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

export const mono = (size: number): CSSProperties => ({ fontFamily: MONO, fontSize: size });
export { LogoMark };
