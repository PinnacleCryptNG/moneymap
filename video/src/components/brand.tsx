import type { CSSProperties, ReactNode } from "react";
import { C, SANS } from "../theme";

/** The MoneyMap mark: an "M" drawn as a route from a "you are here" dot to a mint goal (same drawing as the app). */
export function LogoMark({ size = 32, ring = true, draw = 1 }: { size?: number; ring?: boolean; draw?: number }) {
  const id = `lm${size}`;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id={`${id}bg`} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse"><stop stopColor="#12274f" /><stop offset="1" stopColor="#050d1d" /></linearGradient>
        <linearGradient id={`${id}rt`} x1="12" y1="49" x2="43" y2="15" gradientUnits="userSpaceOnUse"><stop stopColor="#7aa2ff" /><stop offset="1" stopColor="#2ee6a8" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${id}bg)`} />
      {ring && <circle cx="43" cy="16" r="10" stroke="#2ee6a8" strokeOpacity={0.25 * draw} strokeWidth="2" />}
      <path d="M43 16 L52 49" stroke="#ffffff" strokeOpacity={0.26 * draw} strokeWidth="6" strokeLinecap="round" />
      <path d="M12 49 L21.5 17 L32 37 L43 16" stroke={`url(#${id}rt)`} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
      <circle cx="12" cy="49" r="4.5" fill="#ffffff" />
      <circle cx="43" cy="16" r={6 * Math.min(1, draw * 1.2)} fill="#2ee6a8" />
    </svg>
  );
}

export function Wordmark({ size = 19, dark = false, style }: { size?: number; dark?: boolean; style?: CSSProperties }) {
  return (
    <span style={{ fontFamily: SANS, fontWeight: 600, fontSize: size, letterSpacing: "-0.03em", color: dark ? "#fff" : C.ink, ...style }}>
      Money<span style={{ color: dark ? C.mint : C.green }}>Map</span>
    </span>
  );
}

export function Lockup({ size = 32, dark = false, text = 19 }: { size?: number; dark?: boolean; text?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: size * 0.32 }}>
      <LogoMark size={size} />
      <Wordmark size={text} dark={dark} />
    </span>
  );
}

// ---- A few of MoneyMap's own icons (from src/components/icons in the app). ----
const ACC = "#2ee6a8";
export function Icon({ name, size = 18, color = "currentColor", accent = ACC }: { name: string; size?: number; color?: string; accent?: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.75, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const a = { ...p, stroke: accent };
  const body: Record<string, ReactNode> = {
    flag: <><path {...p} d="M6 21V4" /><path {...a} d="M6 4.5h11l-2.6 4 2.6 4H6" /></>,
    pin: <><path {...p} d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0c0 5-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.2" fill={accent} /></>,
    sparkles: <><path {...p} d="M11 3.5l1.8 4.7 4.7 1.8-4.7 1.8L11 16.5l-1.8-4.7L4.5 10l4.7-1.8z" /><path fill={accent} d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z" /></>,
    bell: <><path {...p} d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z" /><path {...p} d="M10 21a2 2 0 0 0 4 0" /></>,
    check: <path {...p} d="M5 12.5l4.5 4.5L19 7.5" />,
    checkCircle: <><circle {...p} cx="12" cy="12" r="9" /><path {...a} d="M8 12.3l2.8 2.8L16 9.6" /></>,
    shield: <><path {...p} d="M12 3l7 3v5.5c0 4.6-3 8-7 9.5-4-1.5-7-4.9-7-9.5V6z" /><path {...a} d="M9 12l2.2 2.2L15.3 10" /></>,
    footprints: <><circle {...p} cx="5" cy="18.5" r="1.8" /><path {...p} d="M7 18c3.5 0 3-5.5 6.5-5.5S16 8 18.5 7.5" /><circle cx="19" cy="7.2" r="2" fill={accent} /></>,
    arrowRight: <><circle cx="4.5" cy="12" r="1.6" fill={accent} /><path {...p} d="M8 12h11M14 7l5 5-5 5" /></>,
    down: <><circle cx="18.5" cy="5.5" r="1.6" fill={accent} /><path {...p} d="M16 8L6 18M6 10v8h8" /></>,
    up: <><circle cx="5.5" cy="18.5" r="1.6" fill={accent} /><path {...p} d="M8 16L18 6M10 6h8v8" /></>,
    piggy: <><path {...p} d="M5 12a7 6 0 0 1 13.5-2.2H20v4.6h-1.7a7 6 0 0 1-2.8 2.7V20H13v-2a8 8 0 0 1-3 0v2H7.5v-3.2A6 6 0 0 1 5 12z" /><path {...p} d="M10.5 9h3" /><circle cx="12" cy="4.6" r="1.8" fill={accent} /></>,
    card: <><rect {...p} x="2.5" y="5.5" width="19" height="13" rx="2.5" /><path {...p} d="M2.5 10h19" /><path {...a} d="M6 14.8h4" /></>,
    target: <><circle {...p} cx="12" cy="12" r="9" /><circle {...p} cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.8" fill={accent} /></>,
    home: <><path {...p} d="M4 10.5L12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z" /><path {...a} d="M10 20.5v-5h4v5" /></>,
    trend: <><path {...p} d="M3 17l6-6 4 4 7.5-7.5" /><path {...a} d="M15 7.5h5.5V13" /></>,
    lock: <><rect {...p} x="5" y="10.5" width="14" height="10" rx="3" /><path {...p} d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><circle cx="12" cy="15.5" r="1.6" fill={accent} /></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0, display: "block" }}>{body[name]}</svg>;
}
