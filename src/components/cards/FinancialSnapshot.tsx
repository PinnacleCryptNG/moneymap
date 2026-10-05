import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import type { FinancialContext } from "../../engine";
import { formatNaira } from "../../utils/format";

export function FinancialSnapshot({ ctx }: { ctx: FinancialContext }) {
  const rows: { label: string; value: string | null; note: string }[] = [
    { label: "Income", value: ctx.income ? formatNaira(ctx.income.average) : null, note: "Average monthly" },
    { label: "Average monthly spending", value: ctx.spending ? formatNaira(ctx.spending.average) : null, note: "Incl. recurring commitments" },
    { label: "Available surplus", value: ctx.surplus ? formatNaira(ctx.surplus.average) : null, note: "After usual spending" },
  ];
  return (
    <section className="card p-6" aria-labelledby="snap-title">
      <p id="snap-title" className="eyebrow mb-4">Where you are</p>
      <dl className="flex flex-col divide-y divide-mist">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
            <dt>
              <span className="block font-medium">{r.label}</span>
              <span className="text-caption !font-normal text-navy-500">{r.note}</span>
            </dt>
            <dd className={`text-[20px] font-semibold tabular-nums ${r.label === "Available surplus" && r.value ? "text-green-700" : ""}`}>
              {r.value ?? (
                <Link to="/app/settings" className="inline-flex items-center gap-1 text-small font-medium text-navy-500 underline-offset-2 hover:underline">
                  <Lock size={14} aria-hidden /> Not shared
                </Link>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

export function summaryTiles(ctx: FinancialContext) {
  const income = ctx.income
    ? { rising: "Rising", high: "Stable", moderate: "Mostly stable", low: "Variable" }[ctx.income.stability]
    : "Not shared";
  const spending = ctx.spending ? { low: "Low", moderate: "Moderate", high: "High" }[ctx.spending.level] : "Not shared";
  const savings = ctx.activity
    ? ctx.activity.savingMonths >= 4
      ? "Growing"
      : ctx.activity.savingMonths >= 2
        ? "Occasional"
        : "Not yet regular"
    : "Not shared";
  return { income, spending, savings };
}
