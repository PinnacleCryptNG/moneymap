import { spring } from "remotion";
import { C, SANS } from "../theme";
import { DATA, FPS, naira, type TEvent } from "../lib";
import { Icon, LogoMark } from "../components/brand";
import { AppHeader, Btn, Eyebrow, StatusBar } from "../components/ui";
import { Ring } from "./MatchScreen";

/** The dashboard on payday: the phone buzzes and MoneyMap's message slides in. */
export function NotifyScreen({ f, events }: { f: number; events: TEvent[] }) {
  const n = events.find((e) => e.type === "notify")!;
  const tap = events.find((e) => e.type === "tap");
  const slide = f < n.at ? 0 : spring({ frame: f - n.at, fps: FPS, config: { damping: 16, stiffness: 170 } });
  const pressed = tap && f >= tap.at - 2 && f <= tap.at + 6 ? 0.03 : 0;
  const badge = f < n.at + 8 ? 0 : spring({ frame: f - n.at - 8, fps: FPS, config: { damping: 9 } });
  return (
    <div style={{ position: "absolute", inset: 0, background: C.canvas, overflow: "hidden" }}>
      <StatusBar />
      <AppHeader badge={badge} />
      <div style={{ position: "absolute", left: 20, right: 20, top: 118 }}>
        <p style={{ margin: 0, fontFamily: SANS, fontSize: 15, color: C.ink3 }}>Good morning, {DATA.name}</p>
        <h1 style={{ margin: "2px 0 0", fontFamily: SANS, fontSize: 30, fontWeight: 600, letterSpacing: "-0.035em", color: C.ink }}>
          Your <span style={{ fontFamily: '"Instrument Serif", Georgia, serif', fontStyle: "italic", fontWeight: 400 }}>MoneyMap</span>
        </h1>
        <div style={{ marginTop: 16, borderRadius: 20, background: "#fff", border: `1px solid ${C.line}`, padding: 18, position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -60, top: -60, width: 180, height: 180, borderRadius: 90, background: "rgba(46,230,168,.16)", filter: "blur(30px)" }} />
          <Eyebrow style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="footprints" size={14} color={C.ink3} /> Your next move</Eyebrow>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginTop: 10 }}>
            <div>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 999, padding: "3px 9px", background: C.green50, color: C.green, fontFamily: SANS, fontSize: 12, fontWeight: 600 }}>
                <Icon name="checkCircle" size={13} color={C.green} accent={C.green} /> Strong match
              </span>
              <p style={{ margin: "8px 0 0", fontFamily: SANS, fontSize: 27, fontWeight: 600, letterSpacing: "-0.03em", color: C.ink }}>SAVE4ME</p>
            </div>
            <Ring value={DATA.score} size={66} />
          </div>
          <p style={{ margin: "8px 0 0", fontFamily: SANS, fontSize: 14, lineHeight: 1.5, color: C.ink2 }}>You have a savings goal and money left over every month — but the money you keep sits in your everyday account.</p>
          <Btn style={{ marginTop: 14, width: 140, height: 44, fontSize: 15 }}>See why <Icon name="arrowRight" size={17} color={C.night} accent={C.night} /></Btn>
        </div>
        <div style={{ marginTop: 14, borderRadius: 20, background: "#fff", border: `1px solid ${C.line}`, padding: 18 }}>
          <Eyebrow>Where you are</Eyebrow>
          <p style={{ margin: "10px 0 0", fontFamily: SANS, fontWeight: 600, fontSize: 40, letterSpacing: "-0.04em", lineHeight: 1, color: C.ink }}>{naira(DATA.left)}</p>
          <p style={{ margin: "6px 0 0", fontFamily: SANS, fontSize: 14.5, color: C.ink2 }}>left over each month, on average</p>
        </div>
      </div>

      {/* The message, sliding in from the top like a real notification. */}
      <div style={{ position: "absolute", left: 10, right: 10, top: 54, zIndex: 40, transform: `translateY(${(slide - 1) * 190}px) scale(${1 - pressed})`, opacity: Math.min(1, slide * 1.5) }}>
        <div style={{ borderRadius: 22, background: "rgba(248,250,252,0.97)", boxShadow: "0 18px 40px -12px rgba(7,18,38,.45)", border: "1px solid rgba(255,255,255,.8)", padding: "12px 14px", display: "flex", gap: 11 }}>
          <LogoMark size={38} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <p style={{ margin: 0, display: "flex", justifyContent: "space-between", fontFamily: SANS, fontSize: 12, color: C.ink3 }}><span style={{ fontWeight: 600, letterSpacing: ".04em" }}>MONEYMAP</span><span>now</span></p>
            <p style={{ margin: "2px 0 0", fontFamily: SANS, fontSize: 14.5, fontWeight: 600, lineHeight: 1.3, color: C.ink }}>Your money has just landed — a good moment for SAVE4ME</p>
            <p style={{ margin: "3px 0 0", fontFamily: SANS, fontSize: 13, lineHeight: 1.35, color: C.ink2, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              Your salary of {naira(DATA.salary)} has just arrived. Setting money aside now, before the month's spending starts, makes it easier to keep.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
