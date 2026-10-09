import { C, MIDNIGHT_BG, SANS } from "../theme";
import { DATA, naira, tween, type TEvent } from "../lib";
import { Icon } from "../components/brand";
import { Btn, Eyebrow, StatusBar } from "../components/ui";

export function Ring({ value, size = 84, dark = false }: { value: number; size?: number; dark?: boolean }) {
  const r = (size - 9) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} stroke={dark ? "rgba(255,255,255,.15)" : C.line} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={7} stroke={C.mint} strokeLinecap="round" strokeDasharray={`${(c * value) / 100} ${c}`} />
      </svg>
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SANS, fontWeight: 700, fontSize: size * 0.25, color: dark ? "#fff" : C.ink }}>{Math.round(value)}%</span>
    </div>
  );
}

/** The recommendation: "We found a strong match." — SAVE4ME, the ring filling to 95%, then why it fits. */
export function MatchScreen({ f }: { f: number; events: TEvent[] }) {
  const head = tween(f, 4, 16);
  const card = tween(f, 16, 34);
  const ring = tween(f, 34, 78, 0, DATA.score);
  const badge = tween(f, 80, 88);
  const why = tween(f, 98, 112);
  const est = tween(f, 132, 142);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.canvas, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 300, background: MIDNIGHT_BG }} />
      <StatusBar dark />
      <div style={{ position: "absolute", left: 22, right: 22, top: 70, opacity: head, transform: `translateY(${(1 - head) * 12}px)` }}>
        <Eyebrow style={{ color: "rgba(255,255,255,.6)" }}>Your next move</Eyebrow>
        <h1 style={{ margin: "8px 0 0", fontFamily: SANS, fontSize: 31, lineHeight: 1.08, fontWeight: 600, letterSpacing: "-0.035em", color: "#fff" }}>We found a strong match.</h1>
        <p style={{ margin: "10px 0 0", fontFamily: SANS, fontSize: 14, lineHeight: 1.45, color: "rgba(255,255,255,.7)" }}>Based on your goal and the information you've allowed MoneyMap to use. You decide what happens next.</p>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 250 + (1 - card) * 60, opacity: card, borderRadius: 22, background: "#fff", border: `1px solid ${C.line}`, boxShadow: "0 24px 48px -24px rgba(7,18,38,.35)", padding: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
          <div style={{ minWidth: 0 }}>
            <p style={{ margin: 0, display: "flex", gap: 6, alignItems: "center" }}>
              <Eyebrow>Recommended for you</Eyebrow>
            </p>
            <span style={{ display: "inline-block", marginTop: 8, borderRadius: 999, padding: "3px 10px", background: "#ebf1ff", color: "#1d4fd6", fontFamily: SANS, fontSize: 12, fontWeight: 600 }}>Savings</span>
            <p style={{ margin: "8px 0 0", fontFamily: SANS, fontSize: 32, fontWeight: 600, letterSpacing: "-0.03em", color: C.ink }}>SAVE4ME</p>
            <p style={{ margin: "2px 0 0", fontFamily: SANS, fontSize: 13.5, color: C.ink3 }}>Zenith Bank · Target savings for a specific goal</p>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <Ring value={ring} size={88} />
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "3px 9px", background: C.green50, color: C.green, fontFamily: SANS, fontSize: 12, fontWeight: 600, opacity: badge, transform: `scale(${0.7 + 0.3 * badge})` }}>
              <Icon name="checkCircle" size={13} color={C.green} accent={C.green} /> Strong match
            </span>
          </div>
        </div>
        <div style={{ height: 1, background: C.line, margin: "16px 0 14px" }} />
        <div style={{ opacity: why, transform: `translateY(${(1 - why) * 12}px)` }}>
          <p style={{ margin: 0, fontFamily: SANS, fontWeight: 600, fontSize: 17, color: C.ink }}>Why it fits</p>
          <p style={{ margin: "6px 0 0", fontFamily: SANS, fontSize: 14.5, lineHeight: 1.5, color: C.ink2 }}>You have a savings goal and money left over every month — but the money you keep sits in your everyday account. SAVE4ME keeps goal money separate from spending money.</p>
        </div>
        <div style={{ marginTop: 14, borderRadius: 14, background: C.surface2, border: `1px solid ${C.line}`, padding: "10px 12px", display: "flex", justifyContent: "space-between", alignItems: "center", opacity: est, transform: `scale(${0.95 + 0.05 * est})` }}>
          <span style={{ fontFamily: SANS, fontSize: 13.5, color: C.ink3 }}>Suggested monthly saving</span>
          <span style={{ fontFamily: SANS, fontSize: 18, fontWeight: 600, color: C.ink }}>{naira(DATA.monthly)}</span>
        </div>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 726, display: "flex", gap: 10, opacity: est }}>
        <Btn kind="secondary" style={{ flex: 1 }}>View product</Btn>
        <Btn style={{ flex: 1 }}>Why this? <Icon name="arrowRight" size={18} color={C.night} accent={C.night} /></Btn>
      </div>
    </div>
  );
}
