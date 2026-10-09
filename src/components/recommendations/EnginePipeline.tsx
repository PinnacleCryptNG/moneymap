import { Check, Circle, Minus } from "lucide-react";
import { useEffect, useState } from "react";
import type { TraceStep } from "../../engine";

/**
 * The decision engine made visible (Phase 2 §5): each stage with the real result it produced.
 * With `reveal`, stages appear one by one while the recommendation is being prepared.
 */
export function EnginePipeline({ steps, reveal = false, compact = false }: { steps: TraceStep[]; reveal?: boolean; compact?: boolean }) {
  const [shown, setShown] = useState(reveal ? 0 : steps.length);
  useEffect(() => {
    if (!reveal) return;
    setShown(0);
    const t = setInterval(() => setShown((n) => (n >= steps.length ? n : n + 1)), 90);
    return () => clearInterval(t);
  }, [reveal, steps.length]);

  return (
    <ol className={`relative flex flex-col ${compact ? "gap-2" : "gap-3"}`} aria-label="How MoneyMap reached this decision">
      {steps.map((s, i) => {
        const visible = i < shown;
        const Icon = s.status === "done" ? Check : s.status === "stop" ? Minus : Circle;
        return (
          <li
            key={s.stage}
            className={`relative grid grid-cols-[28px_1fr] items-start gap-3 transition-opacity duration-300 ${visible ? "opacity-100" : "opacity-25"}`}
          >
            {i < steps.length - 1 && <span className="absolute left-[13px] top-7 h-[calc(100%-12px)] w-0.5 bg-line" aria-hidden />}
            <span
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full ${
                s.status === "done" ? "bg-mint text-night" : s.status === "stop" ? "bg-canvas text-ink-3 ring-1 ring-line" : "bg-surface text-ink-3 ring-1 ring-line"
              }`}
            >
              <Icon size={14} strokeWidth={3} aria-hidden />
            </span>
            <div className="min-w-0 pb-0.5">
              <p className="text-caption uppercase tracking-wide text-ink-3">{s.stage}</p>
              <p className={`text-small ${s.status === "done" ? "font-medium text-ink" : "text-ink-3"}`}>{s.result}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
