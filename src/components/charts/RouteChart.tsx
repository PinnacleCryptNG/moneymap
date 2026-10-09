import { Flag, MapPin, Sparkles } from "../icons";
import { useId, useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatNaira, shortNaira } from "../../utils/format";
import { useWidth } from "../../utils/motion";

export interface RouteChartProps {
  /** Goal amount; 0 when the goal has no amount (the chart then shows what saving adds up to). */
  target: number;
  saved: number;
  /** What's usually left each month, or null when not shared. */
  surplus: number | null;
  /** Months the customer gave themselves. */
  timelineMonths: number;
  goalLabel: string;
  nextMove?: string | null;
  /** Starting monthly amount for the slider; defaults to goal pace. */
  initialMonthly?: number;
  compact?: boolean;
  /** Hides the slider and chips (used where space is tight). */
  controls?: boolean;
  /** Called when the person settles on an amount. */
  onMonthlyChange?: (monthly: number) => void;
}

const MAX_MONTHS = 60;

function addMonths(m: number, from = new Date()) {
  const d = new Date(from.getFullYear(), from.getMonth() + m, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function roundTo(n: number, step: number) {
  return Math.max(step, Math.round(n / step) * step);
}

/**
 * The MoneyMap route: where you are, your next move, and the climb to your goal.
 * Time runs left to right and money bottom to top. Contour lines make the goal the summit.
 * Drag across it (or use the arrow keys) to see any month; move the slider to change the route.
 */
export function RouteChart({
  target,
  saved,
  surplus,
  timelineMonths,
  goalLabel,
  nextMove,
  initialMonthly,
  compact = false,
  controls = true,
  onMonthlyChange,
}: RouteChartProps) {
  const uid = useId().replace(/:/g, "");
  const [box, width] = useWidth<HTMLDivElement>(640);
  const hasTarget = target > 0;
  const remaining = Math.max(0, target - saved);
  const reached = hasTarget && remaining === 0;
  const left = surplus !== null && surplus > 0 ? surplus : null;
  const pace = hasTarget ? Math.max(1, Math.round(remaining / Math.max(1, timelineMonths))) : 0;

  const sliderMax = roundTo(Math.max(left ?? 0, pace * 2, initialMonthly ?? 0, 10_000) * 1.05, 5_000);
  const step = sliderMax <= 60_000 ? 500 : sliderMax <= 600_000 ? 1_000 : 5_000;
  const fallback = hasTarget ? pace : roundTo((left ?? 20_000) / 2, step);
  const [monthly, setMonthly] = useState(() => Math.min(sliderMax, Math.max(step, initialMonthly ?? fallback)));
  const [scrub, setScrub] = useState<number | null>(null);

  // The axis stays fixed for a goal, so moving the slider visibly steepens or flattens the route.
  const horizon = hasTarget ? Math.min(MAX_MONTHS, Math.max(6, Math.ceil(timelineMonths * 1.6))) : 12;
  // A sliver of tolerance so ₦83,333 × 12 counts as reaching ₦1,000,000 (rounding, not a real shortfall).
  const monthsToGoal = hasTarget ? (reached ? 0 : Math.ceil(remaining / monthly - 0.01)) : null;
  const monthsAtAll = hasTarget && left && !reached ? Math.ceil(remaining / left - 0.01) : null;

  const valueAt = (m: number, rate = monthly) => {
    const v = saved + rate * m;
    return hasTarget && v >= target * 0.999 ? target : v;
  };
  const top = hasTarget ? target * 1.12 : Math.max(saved + sliderMax * horizon * 0.6, saved + monthly * horizon) * 1.08;

  const height = compact ? 220 : width < 520 ? 240 : 300;
  const pad = { l: 14, r: 18, t: 34, b: 30 };
  const iw = Math.max(10, width - pad.l - pad.r);
  const ih = height - pad.t - pad.b;
  const x = (m: number) => pad.l + (Math.min(m, horizon) / horizon) * iw;
  const y = (v: number) => pad.t + ih - (Math.max(0, v) / top) * ih;

  // Lines: your plan, the goal's own pace, and saving everything that's left over.
  const planEnd = monthsToGoal === null ? horizon : Math.min(horizon, monthsToGoal);
  const planD = `M ${x(0)} ${y(saved)} L ${x(planEnd)} ${y(valueAt(planEnd))}${monthsToGoal !== null && monthsToGoal < horizon ? ` L ${x(horizon)} ${y(target)}` : ""}`;
  const areaD = `${planD} L ${x(horizon)} ${y(0)} L ${x(0)} ${y(0)} Z`;
  const paceEnd = Math.min(horizon, timelineMonths);
  const paceD = hasTarget && !reached ? `M ${x(0)} ${y(saved)} L ${x(paceEnd)} ${y(valueAt(paceEnd, pace))}` : null;
  const allEnd = monthsAtAll === null ? horizon : Math.min(horizon, monthsAtAll);
  const allD = left && left > monthly * 1.05 && !reached ? `M ${x(0)} ${y(saved)} L ${x(allEnd)} ${y(valueAt(allEnd, left))}` : null;

  const contours = useMemo(() => contourPaths(width, height), [width, height]);
  const ticks = useMemo(() => {
    const n = width < 420 ? 3 : 5;
    return Array.from({ length: n }, (_, i) => Math.round((i / (n - 1)) * horizon));
  }, [width, horizon]);

  const arrival = monthsToGoal !== null && monthsToGoal <= horizon ? monthsToGoal : null;
  const scrubM = scrub ?? null;
  const scrubV = scrubM === null ? 0 : valueAt(scrubM);

  function monthFromPointer(e: PointerEvent<HTMLDivElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left - pad.l;
    return Math.max(0, Math.min(horizon, Math.round((px / iw) * horizon)));
  }
  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const cur = scrub ?? 0;
    const map: Record<string, number> = { ArrowRight: cur + 1, ArrowUp: cur + 1, ArrowLeft: cur - 1, ArrowDown: cur - 1, Home: 0, End: horizon, PageUp: cur + 6, PageDown: cur - 6 };
    if (e.key in map) {
      e.preventDefault();
      setScrub(Math.max(0, Math.min(horizon, map[e.key])));
    } else if (e.key === "Escape") setScrub(null);
  }
  function choose(v: number) {
    const next = Math.min(sliderMax, Math.max(step, Math.round(v / step) * step));
    setMonthly(next);
    onMonthlyChange?.(next);
  }

  const pctAt = (v: number) => (hasTarget ? Math.round((v / target) * 100) : null);
  const valueText = (m: number) => {
    const v = valueAt(m);
    const p = pctAt(v);
    return `${m === 0 ? "Now" : addMonths(m)}: ${formatNaira(v)} saved${p !== null ? `, ${p}% of your goal` : ""}`;
  };

  const chips = [
    hasTarget && !reached ? { label: "Goal pace", value: pace } : null,
    left ? { label: "Half of what's left", value: left / 2 } : null,
    left ? { label: "All of it", value: left } : null,
  ].filter(Boolean) as { label: string; value: number }[];

  const overSurplus = left !== null && monthly > left * 1.01;
  const nextM = Math.max(1, Math.round(horizon * 0.3));
  const nextX = x(nextM);
  const nextY = y(valueAt(nextM));
  const hereAbove = y(saved) > pad.t + ih * 0.5;

  return (
    <figure className="midnight relative overflow-hidden rounded-[24px]" aria-labelledby={`${uid}-cap`}>
      <figcaption id={`${uid}-cap`} className="sr-only">
        {hasTarget
          ? `Route to ${goalLabel}: ${formatNaira(saved)} saved of ${formatNaira(target)}. Saving ${formatNaira(monthly)} a month reaches it ${monthsToGoal === 0 ? "now" : `in ${monthsToGoal} months, by ${addMonths(monthsToGoal ?? 0)}`}.`
          : `Saving ${formatNaira(monthly)} a month adds up to ${formatNaira(valueAt(12))} in a year.`}
      </figcaption>

      {/* Headline: the one number that matters. */}
      <div className={`relative flex flex-wrap items-end justify-between gap-x-6 gap-y-2 ${compact ? "px-5 pt-5" : "px-5 pt-5 sm:px-7 sm:pt-6"}`}>
        <div className="min-w-0">
          <p className="text-[13px] font-medium text-white/60">{hasTarget ? goalLabel : "What saving adds up to"}</p>
          <p className="num font-display text-[26px] font-semibold leading-tight text-white sm:text-[30px]" aria-live="polite">
            {reached ? (
              <>Goal reached <span className="accent-serif text-mint">— well done</span></>
            ) : hasTarget && monthsToGoal !== null ? (
              <>
                {monthsToGoal <= MAX_MONTHS ? addMonths(monthsToGoal) : "5+ years"}
                <span className="ml-2 text-[15px] font-normal text-white/55">{monthsToGoal} {monthsToGoal === 1 ? "month" : "months"}</span>
              </>
            ) : (
              <>
                {formatNaira(valueAt(12))}
                <span className="ml-2 text-[15px] font-normal text-white/55">in 12 months</span>
              </>
            )}
          </p>
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-white/60" aria-label="Key">
          <li className="flex items-center gap-1.5"><span className="h-[3px] w-4 rounded-full bg-mint" aria-hidden />Your plan</li>
          {paceD && <li className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dashed border-[#7aa2ff]" aria-hidden />On time</li>}
          {allD && <li className="flex items-center gap-1.5"><span className="h-0 w-4 border-t-2 border-dotted border-white/50" aria-hidden />Everything left over</li>}
        </ul>
      </div>

      {/* The chart. It's a slider over months for keyboards and screen readers. */}
      <div
        ref={box}
        className="relative mt-2 cursor-crosshair touch-pan-y select-none outline-none focus-visible:ring-2 focus-visible:ring-mint/70 focus-visible:ring-inset"
        style={{ height }}
        tabIndex={0}
        role="slider"
        aria-label="Explore your route month by month"
        aria-valuemin={0}
        aria-valuemax={horizon}
        aria-valuenow={scrub ?? 0}
        aria-valuetext={valueText(scrub ?? 0)}
        onPointerMove={(e) => setScrub(monthFromPointer(e))}
        onPointerDown={(e) => setScrub(monthFromPointer(e))}
        onPointerLeave={(e) => e.pointerType === "mouse" && setScrub(null)}
        onKeyDown={onKey}
        onBlur={() => setScrub(null)}
      >
        <svg width={width} height={height} className="absolute inset-0" aria-hidden="true">
          <defs>
            <linearGradient id={`${uid}-area`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#2ee6a8" stopOpacity="0.32" />
              <stop offset="100%" stopColor="#2ee6a8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={`${uid}-line`} x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#7aa2ff" />
              <stop offset="55%" stopColor="#2ee6a8" />
              <stop offset="100%" stopColor="#b9fbe4" />
            </linearGradient>
            <filter id={`${uid}-glow`} x="-20%" y="-50%" width="140%" height="200%">
              <feGaussianBlur stdDeviation="5" result="b" />
              <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Terrain: the goal is the summit. */}
          <g fill="none" stroke="#ffffff" strokeOpacity="0.055">
            {contours.map((d, i) => <path key={i} d={d} />)}
          </g>
          {/* Month gridlines. */}
          <g stroke="#ffffff" strokeOpacity="0.06">
            {ticks.map((m) => <line key={m} x1={x(m)} x2={x(m)} y1={pad.t - 10} y2={pad.t + ih} />)}
          </g>
          {hasTarget && (
            <g>
              <line x1={pad.l} x2={pad.l + iw} y1={y(target)} y2={y(target)} stroke="#2ee6a8" strokeOpacity="0.35" strokeDasharray="2 6" strokeLinecap="round" />
              <text x={pad.l + iw} y={y(target) - 8} textAnchor="end" fill="#b9fbe4" fillOpacity="0.8" fontSize="11" fontFamily="var(--font-mono)">
                GOAL {shortNaira(target)}
              </text>
            </g>
          )}

          <path d={areaD} fill={`url(#${uid}-area)`} className="mm-morph" />
          {allD && <path d={allD} fill="none" stroke="#ffffff" strokeOpacity="0.45" strokeWidth="2" strokeDasharray="1 6" strokeLinecap="round" className="mm-morph fade-up" />}
          {paceD && <path d={paceD} fill="none" stroke="#7aa2ff" strokeWidth="2" strokeDasharray="6 6" strokeLinecap="round" className="mm-morph fade-up" />}
          {/* The road, then the route drawn on it. */}
          <path d={planD} fill="none" stroke="#ffffff" strokeOpacity="0.08" strokeWidth="12" strokeLinecap="round" strokeLinejoin="round" className="mm-morph" />
          <path
            d={planD}
            pathLength={1}
            fill="none"
            stroke={`url(#${uid}-line)`}
            strokeWidth="3.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            filter={`url(#${uid}-glow)`}
            className="route-draw mm-morph"
            style={{ ["--len" as string]: 1 }}
          />

          {/* Milestones at a quarter, half and three quarters of the way. */}
          {hasTarget && !reached && [0.25, 0.5, 0.75].map((f) => {
            const v = target * f;
            if (v <= saved) return null;
            const m = (v - saved) / monthly;
            if (m > horizon) return null;
            return (
              <g key={f} className="fade-up" style={{ animationDelay: "700ms" }}>
                <rect x={x(m) - 4} y={y(v) - 4} width="8" height="8" rx="1.5" transform={`rotate(45 ${x(m)} ${y(v)})`} fill="#071226" stroke="#b9fbe4" strokeWidth="1.5" className="mm-morph" />
              </g>
            );
          })}

          {/* Scrub guide. */}
          {scrubM !== null && (
            <g>
              <line x1={x(scrubM)} x2={x(scrubM)} y1={pad.t - 10} y2={pad.t + ih} stroke="#ffffff" strokeOpacity="0.35" />
              <circle cx={x(scrubM)} cy={y(scrubV)} r="9" fill="#2ee6a8" fillOpacity="0.2" />
              <circle cx={x(scrubM)} cy={y(scrubV)} r="5" fill="#2ee6a8" stroke="#071226" strokeWidth="2" />
            </g>
          )}

          {/* You are here. */}
          <circle cx={x(0)} cy={y(saved)} r="7" fill="#7aa2ff" className="ping" style={{ transformOrigin: `${x(0)}px ${y(saved)}px` }} />
          <circle cx={x(0)} cy={y(saved)} r="6" fill="#ffffff" stroke="#2f6bff" strokeWidth="3" />

          {/* Month labels. */}
          <g fill="#ffffff" fillOpacity="0.45" fontSize="11" fontFamily="var(--font-mono)">
            {ticks.map((m, i) => (
              <text key={m} x={x(m)} y={height - 10} textAnchor={i === 0 ? "start" : i === ticks.length - 1 ? "end" : "middle"}>
                {m === 0 ? "NOW" : addMonths(m).toUpperCase()}
              </text>
            ))}
          </g>
        </svg>

        {/* Labels as HTML so they stay sharp and readable. */}
        <Pin x={x(0)} y={y(saved)} side={hereAbove ? "above" : "below"} tone="blue" icon={<MapPin size={12} aria-hidden />} title="You are here" body={formatNaira(saved)} align="start" />
        {nextMove && !reached && scrubM === null && width >= 440 && (
          <Pin x={nextX} y={nextY} side="above" tone="mint" icon={<Sparkles size={12} aria-hidden />} title="Next move" body={nextMove} align="center" />
        )}
        {hasTarget && (arrival !== null || reached) && scrubM === null && (
          <Flagpole x={x(arrival ?? 0)} y={y(target)} label={reached ? "Reached" : addMonths(arrival ?? 0)} nearRight={x(arrival ?? 0) > width - 120} />
        )}

        {/* Tooltip while exploring. */}
        {scrubM !== null && (
          <div
            className="pointer-events-none absolute z-20 w-max max-w-[220px] rounded-[12px] border border-white/10 bg-[#0b1b38]/95 px-3 py-2 text-white shadow-xl backdrop-blur"
            style={{
              left: Math.max(8, Math.min(width - 188, x(scrubM) - 90)),
              top: Math.max(4, y(scrubV) - 74),
            }}
          >
            <p className="font-mono text-[11px] uppercase tracking-wide text-white/55">{scrubM === 0 ? "Now" : addMonths(scrubM)}</p>
            <p className="num text-[17px] font-semibold">{formatNaira(scrubV)}</p>
            {hasTarget && (
              <div className="mt-1 flex items-center gap-2">
                <span className="h-1 w-20 overflow-hidden rounded-full bg-white/10"><span className="block h-full rounded-full bg-mint" style={{ width: `${pctAt(scrubV)}%` }} /></span>
                <span className="text-[12px] text-white/70">{pctAt(scrubV)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {controls && !reached && (
        <div className={`relative border-t border-white/10 ${compact ? "px-5 py-4" : "px-5 py-5 sm:px-7"}`}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <label htmlFor={`${uid}-amt`} className="text-[13px] font-medium text-white/65">
              Save each month
              <span className="num mt-0.5 block font-display text-[22px] font-semibold text-white">{formatNaira(monthly)}</span>
            </label>
            {chips.length > 0 && (
              <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick amounts">
                {chips.map((c) => {
                  const active = Math.abs(roundTo(c.value, step) - monthly) < step / 2;
                  return (
                    <button
                      key={c.label}
                      type="button"
                      onClick={() => choose(c.value)}
                      aria-pressed={active}
                      className={`min-h-9 rounded-full px-3 text-[13px] font-medium transition ${active ? "bg-[#2ee6a8] text-[#071226]" : "bg-white/10 text-white hover:bg-white/15"}`}
                    >
                      {c.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <input
            id={`${uid}-amt`}
            type="range"
            min={step}
            max={sliderMax}
            step={step}
            value={monthly}
            onChange={(e) => choose(Number(e.target.value))}
            aria-valuetext={`${formatNaira(monthly)} a month`}
            className="mm-range mt-3 w-full"
            style={{ ["--fill" as string]: `${((monthly - step) / (sliderMax - step)) * 100}%` }}
          />
          <p className="mt-2 text-[13px] leading-relaxed text-white/55">
            {overSurplus ? (
              <span className="text-[#fbc56b]">That's more than the {formatNaira(left!)} you usually have left. </span>
            ) : left ? (
              <span>That's {Math.round((monthly / left) * 100)}% of what's left each month. </span>
            ) : null}
            Before any interest — Zenith sets its own rates.
          </p>
        </div>
      )}
    </figure>
  );
}

function Pin({ x, y, side, tone, icon, title, body, align }: { x: number; y: number; side: "above" | "below"; tone: "blue" | "mint"; icon: React.ReactNode; title: string; body: string; align: "start" | "center" }) {
  return (
    <div
      className="mm-pin pointer-events-none absolute z-10 max-w-[180px]"
      style={{
        left: x,
        top: y,
        transform: `translate(${align === "start" ? "-8px" : "-50%"}, ${side === "above" ? "calc(-100% - 14px)" : "14px"})`,
      }}
    >
      <div style={{ animationDelay: tone === "mint" ? "600ms" : "200ms" }} className={`fade-up rounded-[10px] border px-2.5 py-1.5 backdrop-blur ${tone === "mint" ? "border-mint/30 bg-[#0d2b26]/85" : "border-white/10 bg-[#0b1b38]/85"}`}>
        <p className={`flex items-center gap-1 text-[10px] font-medium uppercase tracking-[0.08em] ${tone === "mint" ? "text-mint" : "text-[#9cbaff]"}`}>{icon}{title}</p>
        <p className="truncate text-[13px] font-semibold text-white">{body}</p>
      </div>
    </div>
  );
}

function Flagpole({ x, y, label, nearRight }: { x: number; y: number; label: string; nearRight: boolean }) {
  return (
    <div className="mm-pin pointer-events-none absolute z-10 fade-up" style={{ left: x, top: y, animationDelay: "800ms" }}>
      <span className="absolute -left-[7px] -top-[7px] h-3.5 w-3.5 rounded-full border-2 border-[#071226] bg-mint shadow-[0_0_0_6px_rgb(46_230_168/0.18)]" />
      <div className={`absolute bottom-3 flex items-center gap-1 whitespace-nowrap rounded-full bg-mint px-2.5 py-1 text-[12px] font-semibold text-night ${nearRight ? "right-0" : "-left-3"}`}>
        <Flag size={12} aria-hidden /> {label}
      </div>
    </div>
  );
}

/** Topographic rings around the summit (top right) and a smaller hill (bottom left). Deterministic. */
function contourPaths(w: number, h: number): string[] {
  const rings = (cx: number, cy: number, count: number, gap: number, seed: number) =>
    Array.from({ length: count }, (_, k) => {
      const r = (k + 1) * gap;
      const pts = Array.from({ length: 48 }, (_, i) => {
        const a = (i / 48) * Math.PI * 2;
        const wob = 1 + 0.14 * Math.sin(3 * a + seed + k * 0.6) + 0.07 * Math.sin(5 * a - k);
        return [cx + Math.cos(a) * r * wob * 1.5, cy + Math.sin(a) * r * wob];
      });
      return `M ${pts.map((p) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" L ")} Z`;
    });
  return [...rings(w * 0.82, h * 0.18, 9, Math.max(16, h * 0.085), 1.3), ...rings(w * 0.12, h * 0.95, 4, Math.max(14, h * 0.07), 4.1)];
}
