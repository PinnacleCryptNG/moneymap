import { C, MIDNIGHT_BG, MONO, SANS } from "../theme";
import { DATA, monthLabel, naira, tween, type TEvent } from "../lib";
import { Icon } from "../components/brand";
import { AppHeader, Eyebrow, StatusBar } from "../components/ui";

const MAX = 180_000; // the app's slider top for this goal (rounded up from what's left each month)
const STEP = 1_000;

/** "Your route": the interactive savings route. Dragging the slider pulls the arrival date earlier. */
export function RouteScreen({ f, events, still = false }: { f: number; events: TEvent[]; still?: boolean }) {
  const drag = events.find((e) => e.type === "drag");
  const p = still || !drag ? 0 : tween(f, drag.at, drag.at + (drag.dur ?? 60));
  const monthly = Math.round((DATA.monthly + (DATA.left - DATA.monthly) * p) / (p > 0 && p < 1 ? STEP : 1)) * (p > 0 && p < 1 ? STEP : 1);
  const draw = still ? 1 : tween(f, 2, 40);
  const months = Math.ceil(DATA.goal / monthly - 0.01);
  const settled = still || f >= (drag ? drag.at + (drag.dur ?? 60) : 0);
  const flagPop = still ? 1 : settled ? tween(f, (drag?.at ?? 0) + (drag?.dur ?? 60), (drag?.at ?? 0) + (drag?.dur ?? 60) + 12) : tween(f, 30, 42);

  // Chart geometry (inside the card).
  const W = 326, H = 210, padL = 8, padR = 10, padT = 22, padB = 24;
  const horizon = 20;
  const top = DATA.goal * 1.12;
  const x = (m: number) => padL + (Math.min(m, horizon) / horizon) * (W - padL - padR);
  const y = (v: number) => padT + (H - padT - padB) * (1 - Math.min(v, DATA.goal) / top);
  const end = Math.min(horizon, months);
  const plan = `M ${x(0)} ${y(0)} L ${x(end)} ${y(DATA.goal)} L ${x(horizon)} ${y(DATA.goal)}`;
  const area = `${plan} L ${x(horizon)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  const pace = `M ${x(0)} ${y(0)} L ${x(12)} ${y(DATA.goal)}`;
  const all = `M ${x(0)} ${y(0)} L ${x(6)} ${y(DATA.goal)}`;
  const contours = Array.from({ length: 7 }, (_, k) => {
    const r = (k + 1) * 18;
    const pts = Array.from({ length: 40 }, (_, i) => {
      const a = (i / 40) * Math.PI * 2;
      const w = 1 + 0.14 * Math.sin(3 * a + 1.3 + k * 0.6) + 0.07 * Math.sin(5 * a - k);
      return `${(W * 0.82 + Math.cos(a) * r * w * 1.5).toFixed(1)} ${(H * 0.2 + Math.sin(a) * r * w).toFixed(1)}`;
    });
    return `M ${pts.join(" L ")} Z`;
  });
  const fill = ((monthly - STEP) / (MAX - STEP)) * 100;
  const chip = (label: string, active: boolean) => (
    <span style={{ height: 32, borderRadius: 16, padding: "0 11px", display: "inline-flex", alignItems: "center", fontFamily: SANS, fontSize: 12.5, fontWeight: 500, background: active ? C.mint : "rgba(255,255,255,.1)", color: active ? C.night : "#fff" }}>{label}</span>
  );

  return (
    <div style={{ position: "absolute", inset: 0, background: C.canvas, overflow: "hidden" }}>
      <StatusBar />
      <AppHeader />
      <div style={{ position: "absolute", left: 16, right: 16, top: 116 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0 4px 10px" }}>
          <Eyebrow style={{ display: "flex", alignItems: "center", gap: 6 }}><Icon name="flag" size={14} color={C.ink3} /> Your route</Eyebrow>
          <span style={{ fontFamily: SANS, fontSize: 13.5, fontWeight: 500, color: "#1d4fd6" }}>Edit goal</span>
        </div>
        <div style={{ borderRadius: 24, background: MIDNIGHT_BG, color: "#fff", overflow: "hidden" }}>
          <div style={{ padding: "16px 16px 0" }}>
            <p style={{ margin: 0, fontFamily: SANS, fontSize: 13, color: "rgba(255,255,255,.6)" }}>Save {naira(DATA.goal)}</p>
            <p style={{ margin: "2px 0 0", fontFamily: SANS, fontSize: 29, fontWeight: 600, letterSpacing: "-0.03em" }}>
              {monthLabel(months)} <span style={{ fontSize: 14, fontWeight: 400, color: "rgba(255,255,255,.55)" }}>{months} months</span>
            </p>
            <div style={{ display: "flex", gap: 12, marginTop: 4, fontFamily: SANS, fontSize: 11, color: "rgba(255,255,255,.6)" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, height: 3, borderRadius: 2, background: C.mint }} />Your plan</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, borderTop: "2px dashed #7aa2ff" }} />On time</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 14, borderTop: "2px dotted rgba(255,255,255,.5)" }} />Everything left over</span>
            </div>
          </div>
          <div style={{ position: "relative", height: H, margin: "4px 0 0 8px" }}>
            <svg width={W + 8} height={H} style={{ position: "absolute", inset: 0 }}>
              <defs>
                <linearGradient id="ar" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#2ee6a8" stopOpacity=".32" /><stop offset="1" stopColor="#2ee6a8" stopOpacity="0" /></linearGradient>
                <linearGradient id="ln" x1="0" x2="1"><stop offset="0" stopColor="#7aa2ff" /><stop offset=".55" stopColor="#2ee6a8" /><stop offset="1" stopColor="#b9fbe4" /></linearGradient>
                <filter id="gl" x="-20%" y="-50%" width="140%" height="200%"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
              </defs>
              <g fill="none" stroke="#fff" strokeOpacity=".06">{contours.map((d, i) => <path key={i} d={d} />)}</g>
              <line x1={padL} x2={W - padR} y1={y(DATA.goal)} y2={y(DATA.goal)} stroke="#2ee6a8" strokeOpacity=".35" strokeDasharray="2 6" />
              <text x={W - padR} y={y(DATA.goal) - 7} textAnchor="end" fill="#b9fbe4" fillOpacity=".8" fontSize="10" fontFamily={MONO}>GOAL ₦1m</text>
              <path d={area} fill="url(#ar)" opacity={draw} />
              {monthly < DATA.left * 0.99 && <path d={all} fill="none" stroke="#fff" strokeOpacity={0.45 * draw} strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" />}
              <path d={pace} fill="none" stroke="#7aa2ff" strokeOpacity={draw} strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" />
              <path d={plan} fill="none" stroke="#fff" strokeOpacity=".08" strokeWidth="11" strokeLinecap="round" strokeLinejoin="round" />
              <path d={plan} fill="none" stroke="url(#ln)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" filter="url(#gl)" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} />
              {[0.25, 0.5, 0.75].map((q) => {
                const m = (DATA.goal * q) / monthly;
                return <rect key={q} x={x(m) - 3.5} y={y(DATA.goal * q) - 3.5} width="7" height="7" rx="1.5" transform={`rotate(45 ${x(m)} ${y(DATA.goal * q)})`} fill="#071226" stroke="#b9fbe4" strokeWidth="1.5" opacity={tween(draw, 0.6, 1)} />;
              })}
              <circle cx={x(0)} cy={y(0)} r="6" fill="#fff" stroke="#2f6bff" strokeWidth="3" />
              <g fill="#fff" fillOpacity=".45" fontSize="9.5" fontFamily={MONO}>
                {[0, 5, 10, 15, 20].map((m, i) => <text key={m} x={x(m)} y={H - 6} textAnchor={i === 0 ? "start" : i === 4 ? "end" : "middle"}>{m === 0 ? "NOW" : monthLabel(m).toUpperCase()}</text>)}
              </g>
            </svg>
            {/* "You are here" and the goal flag. */}
            <div style={{ position: "absolute", left: x(0) + 6, top: y(0) - 50, borderRadius: 9, border: "1px solid rgba(255,255,255,.12)", background: "rgba(11,27,56,.9)", padding: "4px 8px" }}>
              <p style={{ margin: 0, display: "flex", alignItems: "center", gap: 3, fontFamily: SANS, fontSize: 8.5, fontWeight: 600, letterSpacing: ".08em", color: "#9cbaff" }}><Icon name="pin" size={10} color="#9cbaff" />YOU ARE HERE</p>
              <p style={{ margin: 0, fontFamily: SANS, fontSize: 11.5, fontWeight: 600 }}>₦0</p>
            </div>
            <div style={{ position: "absolute", left: x(end), top: y(DATA.goal), opacity: flagPop }}>
              <span style={{ position: "absolute", left: -7, top: -7, width: 14, height: 14, borderRadius: 7, background: C.mint, border: "2px solid #071226", boxShadow: `0 0 0 ${6 + 6 * (1 - flagPop)}px rgba(46,230,168,.2)` }} />
              <span style={{ position: "absolute", bottom: 11, ...(x(end) > 240 ? { right: -6 } : { left: -12 }), whiteSpace: "nowrap", borderRadius: 999, background: C.mint, color: C.night, fontFamily: SANS, fontSize: 11.5, fontWeight: 600, padding: "3px 9px", display: "flex", alignItems: "center", gap: 3, transform: `scale(${0.7 + 0.3 * flagPop})` }}>
                <Icon name="flag" size={11} color={C.night} accent={C.night} /> {monthLabel(months)}
              </span>
            </div>
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,.1)", padding: "12px 16px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 8 }}>
              <div>
                <p style={{ margin: 0, fontFamily: SANS, fontSize: 12.5, color: "rgba(255,255,255,.65)" }}>Save each month</p>
                <p style={{ margin: "1px 0 0", fontFamily: SANS, fontSize: 22, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{naira(monthly)}</p>
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              {chip("Goal pace", monthly === DATA.monthly)}
              {chip("Half of what's left", monthly === DATA.left / 2)}
              {chip("All of it", monthly === DATA.left)}
            </div>
            <div style={{ position: "relative", height: 26, marginTop: 8 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 10, height: 6, borderRadius: 3, background: `linear-gradient(90deg, #2ee6a8 ${fill}%, rgba(255,255,255,.12) ${fill}%)` }} />
              <div style={{ position: "absolute", top: 2, left: `calc(${fill}% - 11px)`, width: 22, height: 22, borderRadius: 11, background: "#fff", border: "4px solid #2ee6a8", boxShadow: "0 0 0 6px rgba(46,230,168,.18)" }} />
            </div>
            <p style={{ margin: "6px 0 0", fontFamily: SANS, fontSize: 11.5, lineHeight: 1.45, color: "rgba(255,255,255,.55)" }}>
              That's {Math.round((monthly / DATA.left) * 100)}% of what's left each month. Before any interest — Zenith sets its own rates.
            </p>
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 16, right: 16, top: 676, borderRadius: 20, background: "#fff", border: `1px solid ${C.line}`, padding: "14px 16px" }}>
        <Eyebrow>Where you are</Eyebrow>
        <p style={{ margin: "8px 0 0", fontFamily: SANS, fontWeight: 600, fontSize: 34, letterSpacing: "-0.04em", lineHeight: 1, color: C.ink }}>{naira(DATA.left)}</p>
        <p style={{ margin: "4px 0 0", fontFamily: SANS, fontSize: 13.5, color: C.ink2 }}>left over each month, on average</p>
      </div>
    </div>
  );
}
