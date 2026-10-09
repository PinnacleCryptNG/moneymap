import { C, SANS } from "../theme";
import { DATA, naira, tween, type TEvent } from "../lib";
import { Icon } from "../components/brand";
import { Btn, Eyebrow, OnbHeader, StatusBar, pressedAt } from "../components/ui";

const OPTIONS: [string, string, string][] = [
  ["target", "Save more", "Put money aside for something specific"],
  ["card", "Pay for something big", "Rent, school fees, a wedding, a car…"],
  ["home", "Manage my everyday money", "Smoother payments and spending"],
  ["trend", "Grow my money", "Make my spare money earn more"],
];

/** Onboarding step 1: "What are you working towards?" — tap Save more, type ₦1,000,000 and 12 months. */
export function GoalScreen({ f, events }: { f: number; events: TEvent[] }) {
  const scroll = tween(f, 28, 46, 0, 210);
  const picked = f >= 20;
  const fields = tween(f, 24, 38);
  const amountDigits = events.filter((e) => e.type === "type" && !e.field && e.at <= f).map((e) => e.char).join("");
  const monthsDigits = events.filter((e) => e.type === "type" && e.field === "months" && e.at <= f).map((e) => e.char).join("");
  const focus = f >= 46 && f < 96 ? "amount" : f >= 96 && f < 130 ? "months" : null;
  const caret = Math.floor(f / 8) % 2 === 0;
  const est = tween(f, 112, 122);

  const field = (label: string, value: string, prefix: string | null, focused: boolean, hint?: string) => (
    <div style={{ marginBottom: 14 }}>
      <p style={{ margin: "0 0 6px", fontFamily: SANS, fontSize: 14, fontWeight: 600, color: C.ink }}>{label}</p>
      <div style={{ height: 52, borderRadius: 12, background: "#fff", border: `2px solid ${focused ? C.blue : C.line}`, boxShadow: focused ? "0 0 0 4px rgba(47,107,255,0.15)" : "none", display: "flex", alignItems: "center", padding: "0 14px", gap: 6, fontFamily: SANS, fontSize: 19, fontWeight: 500, color: C.ink }}>
        {prefix && <span style={{ color: C.ink3 }}>{prefix}</span>}
        <span style={{ fontVariantNumeric: "tabular-nums" }}>{value}</span>
        {focused && caret && <span style={{ width: 2, height: 22, background: C.blue }} />}
        {!value && !focused && <span style={{ color: "#94a3b8" }}>{prefix ? "1,000,000" : "12"}</span>}
      </div>
      {hint && <p style={{ margin: "5px 0 0", fontFamily: SANS, fontSize: 13, color: C.ink3 }}>{hint}</p>}
    </div>
  );

  return (
    <div style={{ position: "absolute", inset: 0, background: C.canvas, overflow: "hidden" }}>
      <StatusBar />
      <OnbHeader step={1} />
      <div style={{ position: "absolute", left: 20, right: 20, top: 120 - scroll }}>
        <h1 style={{ margin: 0, fontFamily: SANS, fontSize: 27, lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.035em", color: C.ink }}>What are you working towards?</h1>
        <p style={{ margin: "10px 0 0", fontFamily: SANS, fontSize: 15, lineHeight: 1.5, color: C.ink3 }}>Start with what you want to achieve. Products come after the need.</p>
        <Eyebrow style={{ marginTop: 20, marginBottom: 10 }}>Choose your goal</Eyebrow>
        {OPTIONS.map(([icon, title, hint], i) => {
          const sel = picked && i === 0;
          const pop = sel ? 1 + 0.04 * Math.sin(Math.min(1, (f - 20) / 8) * Math.PI) : 1;
          return (
            <div key={title} style={{ height: 62, marginBottom: 8, borderRadius: 16, background: sel ? "#effcf7" : "#fff", border: `2px solid ${sel ? C.mint600 : C.line}`, display: "flex", alignItems: "center", gap: 12, padding: "0 14px", transform: `scale(${pop})` }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: sel ? C.mint : C.green50, display: "flex", alignItems: "center", justifyContent: "center", color: C.green }}>
                <Icon name={icon} size={20} accent={sel ? C.night : C.mint600} color={sel ? C.night : C.green} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontFamily: SANS, fontWeight: 600, fontSize: 15.5, color: C.ink }}>{title}</span>
                <span style={{ display: "block", fontFamily: SANS, fontSize: 13, color: C.ink3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{hint}</span>
              </span>
              <span style={{ width: 22, height: 22, borderRadius: 11, border: `2px solid ${sel ? C.mint600 : "#cbd5e1"}`, background: sel ? C.mint600 : "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {sel && <Icon name="check" size={14} color="#fff" />}
              </span>
            </div>
          );
        })}
        <div style={{ opacity: fields, transform: `translateY(${(1 - fields) * 16}px)`, marginTop: 14 }}>
          {field("Target amount", amountDigits ? Number(amountDigits).toLocaleString("en-NG") : "", "₦", focus === "amount")}
          {field("Timeline (months)", monthsDigits, null, focus === "months", "When do you need it by?")}
          <div style={{ height: 50, borderRadius: 12, background: C.green50, color: C.green, fontFamily: SANS, fontSize: 14.5, fontWeight: 500, display: "flex", alignItems: "center", padding: "0 14px", opacity: est, transform: `scale(${0.96 + 0.04 * est})` }}>
            Estimate: about {naira(DATA.monthly)} a month for {DATA.months} months.
          </div>
          <Btn style={{ marginTop: 16 }} pressed={pressedAt(events, f, 195, 655)}>Continue</Btn>
        </div>
      </div>
    </div>
  );
}
