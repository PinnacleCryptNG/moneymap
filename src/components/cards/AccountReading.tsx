import { Lock, ReceiptText } from "lucide-react";
import type { FinancialContext } from "../../engine";
import { CATEGORY_LABELS } from "../../engine/ledger";
import { formatNaira } from "../../utils/format";

function monthRange(months: string[]) {
  const fmt = (m: string) => new Date(`${m}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "long", timeZone: "UTC" });
  const year = months.at(-1)?.slice(0, 4);
  return months.length ? `${fmt(months[0])} – ${fmt(months.at(-1)!)} ${year}` : "";
}

function NotShared({ what }: { what: string }) {
  return (
    <p className="flex items-center gap-2 text-small text-ink-3">
      <Lock size={14} aria-hidden /> {what} not shared
    </p>
  );
}

/** Step 2: how MoneyMap read the customer's statement — sources of money, where it goes, fixed commitments, savings. */
export function AccountReading({ ctx }: { ctx: FinancialContext }) {
  const l = ctx.ledger;
  if (!l) return null;
  const maxSpend = Math.max(1, ...(l.spending?.byCategory.map((c) => c.monthlyAverage) ?? [1]));
  return (
    <section className="card p-5 md:p-6" aria-labelledby="reading-title">
      <h2 id="reading-title" className="mb-1 flex items-center gap-2 !text-[20px]">
        <ReceiptText size={22} className="text-blue" aria-hidden /> How MoneyMap read your account
      </h2>
      <p className="mb-5 text-small text-ink-3">
        {l.transactionCount} transactions from {monthRange(l.months)}, sorted by what each payment was for — from the bank narration alone. Monthly averages.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="min-w-0">
          <h3 className="mb-3 !text-[16px]">Money in</h3>
          {l.income ? (
            <ul className="flex flex-col gap-2 text-small">
              {l.income.sources.map((s) => (
                <li key={s.category} className="flex justify-between gap-3">
                  <span>{CATEGORY_LABELS[s.category]}</span>
                  <span className="font-semibold tabular-nums text-green-700">{formatNaira(s.monthlyAverage)}</span>
                </li>
              ))}
              {l.income.employer && <li className="text-caption !font-normal text-ink-3">Salary from {l.income.employer} · {l.income.mainCreditCount} payments found</li>}
            </ul>
          ) : (
            <NotShared what="Income patterns" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 !text-[16px]">Where it goes</h3>
          {l.spending ? (
            <ul className="flex flex-col gap-2.5 text-small">
              {l.spending.byCategory.slice(0, 7).map((c) => (
                <li key={c.category}>
                  <div className="mb-1 flex justify-between gap-3">
                    <span>{CATEGORY_LABELS[c.category]}</span>
                    <span className="tabular-nums">{formatNaira(c.monthlyAverage)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line" role="img" aria-label={`${Math.round(c.share * 100)}% of spending`}>
                    <div className="h-full rounded-full bg-blue" style={{ width: `${(c.monthlyAverage / maxSpend) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <NotShared what="Spending patterns" />
          )}
        </div>
        <div className="min-w-0">
          <h3 className="mb-3 !text-[16px]">Fixed commitments</h3>
          {l.spending ? (
            l.spending.recurring.length ? (
              <ul className="flex flex-col gap-2 text-small">
                {l.spending.recurring.map((r) => (
                  <li key={r.label} className="flex justify-between gap-3">
                    <span className="min-w-0 truncate" title={r.label}>{r.label}</span>
                    <span className="shrink-0 tabular-nums">{formatNaira(r.monthlyAverage)}</span>
                  </li>
                ))}
                <li className="text-caption !font-normal text-ink-3">Payments that repeat at least 5 of 6 months at a steady amount.</li>
              </ul>
            ) : (
              <p className="text-small text-ink-3">No regular commitments found.</p>
            )
          ) : (
            <NotShared what="Spending patterns" />
          )}
          {l.activity && l.activity.savingsTransfersMonthly > 0 && (
            <p className="mt-4 rounded-[10px] bg-green-50 p-3 text-small text-green-700">
              Saving {formatNaira(l.activity.savingsTransfersMonthly)} a month into {l.activity.savingsDestination ?? "savings"} — counted as saving, not spending.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
