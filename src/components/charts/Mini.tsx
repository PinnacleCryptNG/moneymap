import { useId, useState } from "react";

/** A small trend line with a soft fill. Decorative: the number beside it carries the meaning. */
export function Sparkline({ values, width = 120, height = 36, colour = "var(--mint)" }: { values: number[]; width?: number; height?: number; colour?: string }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return null;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const pts = values.map((v, i) => [(i / (values.length - 1)) * (width - 4) + 2, height - 3 - ((v - min) / (max - min || 1)) * (height - 8)]);
  const line = pts.map((p, i) => `${i ? "L" : "M"} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true" className="overflow-visible">
      <defs>
        <linearGradient id={`${id}-f`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line} L ${last[0]} ${height} L ${pts[0][0]} ${height} Z`} fill={`url(#${id}-f)`} />
      <path d={line} fill="none" stroke={colour} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="route-draw" style={{ ["--len" as string]: 1 }} />
      <circle cx={last[0]} cy={last[1]} r="3" fill={colour} />
    </svg>
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  colour: string;
}

/** A ring split into slices. Hover or focus a legend row to highlight its slice. */
export function Donut({ slices, size = 168, centre, centreLabel }: { slices: DonutSlice[]; size?: number; centre: string; centreLabel: string }) {
  const [active, setActive] = useState<number | null>(null);
  const total = slices.reduce((a, s) => a + s.value, 0) || 1;
  const r = size / 2 - 12;
  const c = 2 * Math.PI * r;
  let offset = 0;
  const shown = active === null ? null : slices[active];
  return (
    <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="16" className="stroke-line" />
          {slices.map((s, i) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.colour}
                strokeWidth={active === i ? 22 : 16}
                strokeDasharray={`${Math.max(0, len - 3)} ${c}`}
                strokeDashoffset={-offset}
                opacity={active === null || active === i ? 1 : 0.3}
                style={{ transition: "stroke-width 200ms ease, opacity 200ms ease" }}
              />
            );
            offset += len;
            return el;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="num font-display text-[28px] font-semibold leading-none">{shown ? `${Math.round((shown.value / total) * 100)}%` : centre}</span>
          <span className="mt-1 max-w-[90px] text-caption !font-normal text-ink-3">{shown ? shown.label : centreLabel}</span>
        </div>
      </div>
      <ul className="flex w-full flex-col gap-1">
        {slices.map((s, i) => (
          <li key={s.label}>
            <button
              type="button"
              className={`flex min-h-9 w-full items-center gap-2.5 rounded-[10px] px-2 text-left text-small transition ${active === i ? "bg-surface-2" : "hover:bg-surface-2"}`}
              onMouseEnter={() => setActive(i)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(i)}
              onBlur={() => setActive(null)}
              aria-label={`${s.label}: ${Math.round((s.value / total) * 100)}%`}
            >
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.colour }} aria-hidden />
              <span className="flex-1 text-ink-2">{s.label}</span>
              <span className="num text-ink-3">{Math.round((s.value / total) * 100)}%</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Stages that narrow left to right (or top to bottom on phones), with the rate between each. */
export function Funnel({ stages }: { stages: { label: string; value: number; note?: string }[] }) {
  const max = Math.max(...stages.map((s) => s.value), 1);
  return (
    <ol className="flex flex-col gap-3">
      {stages.map((s, i) => {
        const prev = i ? stages[i - 1].value : null;
        return (
          <li key={s.label} className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 sm:grid-cols-[160px_1fr_96px]">
            <div className="min-w-0">
              <p className="truncate text-small font-medium">{s.label}</p>
              {s.note && <p className="truncate text-caption !font-normal text-ink-3">{s.note}</p>}
            </div>
            <div className="order-last col-span-2 h-3 overflow-hidden rounded-full bg-surface-2 sm:order-none sm:col-span-1 sm:h-8 sm:rounded-[10px]">
              <div
                className="h-full origin-left rounded-full sm:rounded-[10px]"
                style={{
                  width: `${Math.max(2, (s.value / max) * 100)}%`,
                  background: `linear-gradient(90deg, var(--blue), color-mix(in oklab, var(--blue) ${100 - i * 30}%, var(--mint)))`,
                  animation: `mm-grow-x 800ms ${i * 120}ms both cubic-bezier(.22,1,.36,1)`,
                }}
              />
            </div>
            <p className="text-right">
              <span className="num block font-semibold">{s.value.toLocaleString()}</span>
              {prev !== null && <span className="num block text-caption !font-normal text-ink-3">{Math.round((s.value / prev) * 100)}% of above</span>}
            </p>
          </li>
        );
      })}
    </ol>
  );
}
