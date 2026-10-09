import { C, SANS } from "../theme";
import { tween, type TEvent } from "../lib";
import { Icon } from "../components/brand";
import { Btn, OnbHeader, StatusBar, Switch, pressedAt } from "../components/ui";

const ROWS: [string, string][] = [
  ["Account activity", "Used to see your balance, how often you use your account and how you put money aside."],
  ["Income patterns", "Used to see when money comes in and how much."],
  ["Spending patterns", "Used to see your regular bills and where your money goes."],
  ["Existing Zenith products", "Used to see which products you already have."],
  ["Financial goals", "Used to match products to what you are trying to achieve."],
];

/** Onboarding: "Choose what MoneyMap can use" — Allow all flips the five permissions on. */
export function PermissionsScreen({ f, events }: { f: number; events: TEvent[] }) {
  const toggles = events.filter((e) => e.type === "toggle");
  const promise = tween(f, 68, 80);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.canvas, overflow: "hidden" }}>
      <StatusBar />
      <OnbHeader step={3} />
      <div style={{ position: "absolute", left: 20, right: 20, top: 118 }}>
        <h1 style={{ margin: 0, fontFamily: SANS, fontSize: 27, lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.035em", color: C.ink }}>Choose what MoneyMap can use</h1>
        <p style={{ margin: "8px 0 0", fontFamily: SANS, fontSize: 15, color: C.ink3 }}>Let MoneyMap understand your financial habits.</p>
        <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
          <Btn kind="secondary" style={{ height: 40, fontSize: 14, padding: "0 14px", width: 120 }}>Turn all off</Btn>
          <Btn style={{ height: 40, fontSize: 14, padding: "0 14px", width: 104 }} pressed={pressedAt(events, f, 209, 252)}>Allow all</Btn>
        </div>
        <div style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 8 }}>
          {ROWS.map(([title, use], i) => {
            const t = toggles[i];
            const on = t ? tween(f, t.at, t.at + 5) : 0;
            return (
              <div key={title} style={{ height: 74, borderRadius: 16, background: "#fff", border: `1px solid ${on > 0.5 ? "rgba(47,107,255,0.35)" : C.line}`, display: "flex", alignItems: "center", gap: 12, padding: "0 14px" }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontFamily: SANS, fontWeight: 600, fontSize: 15, color: C.ink }}>{title}</span>
                  <span style={{ display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", fontFamily: SANS, fontSize: 12.5, lineHeight: 1.35, color: C.ink3, marginTop: 2 }}>{use}</span>
                </span>
                <Switch on={on} />
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 12, borderRadius: 16, background: C.night, padding: "12px 14px", color: "#fff", opacity: 0.35 + promise * 0.65 }}>
          <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontWeight: 600, fontSize: 14 }}><Icon name="shield" size={17} color="#fff" /> Our promise</p>
          <p style={{ margin: "4px 0 0", fontFamily: SANS, fontSize: 12.5, lineHeight: 1.4, color: "rgba(255,255,255,0.72)" }}>We never use data you haven't allowed. Withdrawing a permission stops its use straight away.</p>
        </div>
        <Btn style={{ marginTop: 12 }} pressed={pressedAt(events, f, 195, 808)}>Continue</Btn>
      </div>
    </div>
  );
}
