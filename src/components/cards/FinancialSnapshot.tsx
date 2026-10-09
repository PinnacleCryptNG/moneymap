import { Lock } from "lucide-react";
import { Link } from "react-router-dom";
import type { FinancialContext } from "../../engine";
import type { CustomerProfile, ExistingProductId } from "../../types";
import { formatNaira } from "../../utils/format";

export const HOLDING_LABELS: Record<ExistingProductId, string> = {
  current_account: "Current account",
  savings_account: "Savings account",
  debit_card: "Debit card",
  credit_card: "Credit card",
  save4me: "SAVE4ME",
  aspire: "Aspire",
  eazysave: "EazySave",
  personal_loan: "Personal loan",
  asset_finance: "Asset finance",
};

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function cashFlowPattern(ctx: FinancialContext): string | null {
  if (!ctx.income || !ctx.spending) return null;
  const first = !ctx.income.day
    ? "Income comes in each month"
    : ctx.income.source === "salary"
      ? `Salary lands around the ${ordinal(ctx.income.day)}`
      : `Allowance arrives around the ${ordinal(ctx.income.day)}`;
  const bills = `${formatNaira(ctx.spending.recurring)} in fixed bills and commitments follows`;
  const end = ctx.surplus
    ? ctx.surplus.average > 0.1 * ctx.income.average
      ? `about ${formatNaira(ctx.surplus.average)} is usually left by month-end`
      : "very little is left by month-end"
    : "";
  return [first, bills, end].filter(Boolean).join("; ") + ".";
}

function savingsLine(ctx: FinancialContext): string | null {
  if (!ctx.surplus) return null;
  const left = formatNaira(Math.max(0, ctx.surplus.average));
  if (ctx.holdings?.includes("save4me")) return `${left} left monthly · saving through SAVE4ME`;
  if (ctx.surplus.ratio < 0.08) return `${left} left monthly · little room to save yet`;
  if (ctx.holdings && !ctx.holdings.some((h) => h === "savings_account" || h === "eazysave")) return `${left} left monthly · kept in everyday account`;
  return `${left} left monthly`;
}

export function FinancialSnapshot({ ctx, customer }: { ctx: FinancialContext; customer: CustomerProfile }) {
  const stability = ctx.income
    ? { rising: "rising", high: "steady", moderate: "varies a little", low: "irregular" }[ctx.income.stability]
    : "";
  const rows: { label: string; value: React.ReactNode | null; tone?: "green" }[] = [
    {
      label: "Income",
      value: ctx.income ? (
        <>
          <span className="font-semibold tabular-nums">{formatNaira(ctx.income.average)}</span>
          <span className="text-navy-500"> / month · {!ctx.income.day ? "from what you told us" : ctx.income.source === "salary" ? "salary" : "allowance"}, {stability}</span>
        </>
      ) : null,
    },
    {
      label: "Spending",
      value: ctx.spending ? (
        <>
          <span className="font-semibold tabular-nums">{formatNaira(ctx.spending.average)}</span>
          <span className="text-navy-500"> / month · incl. {formatNaira(ctx.spending.recurring)} fixed</span>
        </>
      ) : null,
    },
    { label: "Savings", value: savingsLine(ctx), tone: "green" },
    { label: "Cash-flow pattern", value: cashFlowPattern(ctx) },
    {
      label: "Your Zenith products",
      value: ctx.holdings ? (
        <span className="flex flex-wrap gap-1.5">
          {ctx.holdings.map((h) => (
            <span key={h} className="rounded-full border border-mist bg-cloud px-2.5 py-0.5 text-small">{HOLDING_LABELS[h]}</span>
          ))}
        </span>
      ) : null,
    },
  ];
  return (
    <section className="card p-6" aria-labelledby="snap-title">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <p id="snap-title" className="eyebrow">Where you are</p>
        <p className="text-caption !font-normal text-navy-500">{customer.occupation} · {customer.city}</p>
      </div>
      <dl className="flex flex-col divide-y divide-mist">
        {rows.map((r) => (
          <div key={r.label} className="grid grid-cols-1 gap-1 py-3 first:pt-0 last:pb-0 sm:grid-cols-[150px_1fr] sm:gap-4">
            <dt className="text-small font-medium text-navy-500">{r.label}</dt>
            <dd className={`min-w-0 ${r.tone === "green" && r.value ? "font-medium text-green-700" : ""}`}>
              {r.value ?? (
                <Link to="/app/settings" className="inline-flex min-h-6 items-center gap-1 text-small font-medium text-navy-500 underline-offset-2 hover:underline">
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
    ? { rising: "Rising", high: "Stable", moderate: "Varies a little", low: "Irregular" }[ctx.income.stability]
    : "Not shared";
  const spending = ctx.spending ? { low: "Low", moderate: "Moderate", high: "High" }[ctx.spending.level] : "Not shared";
  // Saving habits come only from the statement; a balance the customer told us doesn't show a habit.
  const savings = ctx.activity && ctx.permissions.account_activity
    ? ctx.activity.savingMonths >= 4
      ? "Growing"
      : ctx.activity.savingMonths >= 2
        ? "Occasional"
        : "Not yet regular"
    : "Not shared";
  return { income, spending, savings };
}
