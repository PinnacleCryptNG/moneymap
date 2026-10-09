import { interpolate } from "remotion";
import { C, MONO, SANS } from "../theme";
import { DATA, naira, out, tween, type TEvent } from "../lib";
import { Icon } from "../components/brand";
import { Btn, Eyebrow, OnbHeader, StatusBar, pressedAt } from "../components/ui";

// Example statement lines from the sample customer's ledger in the app (made-up data).
const LINES: [string, string][] = [
  ["NIP/BRIGHTPATH LOGISTICS LTD/SALARY SEP 2026", "Salary"],
  ["POS/SHOPRITE LEKKI/LA NG", "Food & groceries"],
  ["NIP TRF TO ADAEZE NWOSU/RENT CONTRIBUTION", "Rent"],
  ["IKEDC PREPAID/TOKEN 4512 8803 2210", "Electricity & utilities"],
  ["DSTV COMPACT/SUBSCRIPTION/7024***118", "TV & subscriptions"],
];
const BAR: [number, string][] = [[118_142, "#2f6bff"], [60_000, "#7aa2ff"], [30_000, "#f5b74a"], [15_700, "#c084fc"], [56_158, "#94a3b8"], [170_000, "#2ee6a8"]];

/** "Your financial map is ready": statement lines get labelled, then what's left over counts up. */
export function ReadingScreen({ f, events }: { f: number; events: TEvent[] }) {
  const pops = events.filter((e) => e.type === "pop");
  const count = interpolate(f, [78, 118], [12_000, DATA.left], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: out });
  const block = tween(f, 76, 86);
  const bar = tween(f, 112, 136);
  return (
    <div style={{ position: "absolute", inset: 0, background: C.canvas, overflow: "hidden" }}>
      <StatusBar />
      <OnbHeader step={4} />
      <div style={{ position: "absolute", left: 20, right: 20, top: 118 }}>
        <h1 style={{ margin: 0, fontFamily: SANS, fontSize: 27, lineHeight: 1.12, fontWeight: 600, letterSpacing: "-0.035em", color: C.ink }}>Your financial map is ready</h1>
        <div style={{ marginTop: 14, borderRadius: 18, background: "#fff", border: `1px solid ${C.line}`, padding: "14px 14px 10px" }}>
          <p style={{ margin: 0, fontFamily: SANS, fontWeight: 600, fontSize: 15.5, color: C.ink }}>How MoneyMap read your account</p>
          <p style={{ margin: "2px 0 8px", fontFamily: SANS, fontSize: 12.5, color: C.ink3 }}>138 transactions from April – September 2026</p>
          {LINES.map(([n, cat], i) => {
            const at = pops[i]?.at ?? 0;
            const line = tween(f, at - 8, at - 1);
            const tag = tween(f, at, at + 7);
            return (
              <div key={n} style={{ height: 38, borderTop: i ? `1px solid ${C.line}` : "none", display: "flex", alignItems: "center", gap: 8, opacity: line, transform: `translateX(${(1 - line) * -14}px)` }}>
                <span style={{ flex: 1, minWidth: 0, fontFamily: MONO, fontSize: 10.5, color: C.ink2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n}</span>
                <span style={{ flexShrink: 0, borderRadius: 999, padding: "3px 9px", background: C.green50, color: C.green, fontFamily: SANS, fontSize: 11, fontWeight: 600, opacity: tag, transform: `scale(${0.6 + 0.4 * tag})` }}>{cat}</span>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, opacity: block, transform: `translateY(${(1 - block) * 14}px)` }}>
          <p style={{ margin: 0, fontFamily: SANS, fontWeight: 600, fontSize: 46, letterSpacing: "-0.04em", lineHeight: 1, color: C.ink, fontVariantNumeric: "tabular-nums" }}>{naira(count)}</p>
          <p style={{ margin: "6px 0 0", fontFamily: SANS, fontSize: 15, color: C.ink2 }}>left over each month, on average</p>
          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            {[["down", "Money in", DATA.income, C.green], ["up", "Money out", DATA.spending, "#9a5b05"]].map(([ic, label, v, col]) => (
              <div key={label as string} style={{ flex: 1, borderRadius: 14, background: "#fff", border: `1px solid ${C.line}`, padding: "9px 12px" }}>
                <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 5, fontFamily: SANS, fontSize: 12, color: C.ink3 }}><Icon name={ic as string} size={14} color={col as string} />{label}</p>
                <p style={{ margin: "2px 0 0", fontFamily: SANS, fontWeight: 600, fontSize: 17, color: C.ink }}>{naira(v as number)}</p>
              </div>
            ))}
          </div>
          <Eyebrow style={{ marginTop: 12, marginBottom: 6 }}>Where it goes</Eyebrow>
          <div style={{ display: "flex", height: 10, gap: 2, borderRadius: 6, overflow: "hidden", background: C.line }}>
            {BAR.map(([v, col], i) => (
              <span key={i} style={{ width: `${(v / DATA.income) * 100 * bar}%`, background: col }} />
            ))}
          </div>
        </div>
        <Btn style={{ marginTop: 18 }} pressed={pressedAt(events, f, 195, 688)}>See my recommendation</Btn>
      </div>
    </div>
  );
}
