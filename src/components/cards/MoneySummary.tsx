import { ArrowDownLeft, ArrowUpRight, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import type { FinancialContext } from "../../engine";
import { CATEGORY_LABELS } from "../../engine/ledger";
import type { CustomerProfile } from "../../types";
import { formatNaira, shortNaira } from "../../utils/format";
import { useCountUp } from "../../utils/motion";
import { HOLDING_LABELS } from "./FinancialSnapshot";

const BAR_COLOURS = ["#2f6bff", "#7aa2ff", "#f5b74a", "#c084fc", "#94a3b8"];

function NotShared() {
  return (
    <Link to="/app/settings" className="inline-flex min-h-6 items-center gap-1 text-small font-medium text-ink-3 underline-offset-2 hover:underline">
      <Lock size={13} aria-hidden /> Not shared
    </Link>
  );
}

/** Where you are, at a glance: one big number, money in and out, and where it goes. */
export function MoneySummary({ ctx, customer }: { ctx: FinancialContext; customer: CustomerProfile }) {
  const left = ctx.surplus ? Math.max(0, ctx.surplus.average) : null;
  const shown = useCountUp(left ?? 0);

  // Where the money goes: the biggest spending groups from the statement, then the rest, then what's left.
  const income = ctx.income?.average ?? 0;
  const cats = ctx.ledger?.spending?.byCategory ?? [];
  const top = cats.slice(0, 4);
  const rest = cats.slice(4).reduce((a, c) => a + c.monthlyAverage, 0);
  const segments = [
    ...top.map((c, i) => ({ label: CATEGORY_LABELS[c.category], value: c.monthlyAverage, colour: BAR_COLOURS[i] })),
    ...(rest > 0 ? [{ label: "Everything else", value: rest, colour: BAR_COLOURS[4] }] : []),
  ];
  if (!segments.length && ctx.spending) segments.push({ label: "Spending", value: ctx.spending.average, colour: BAR_COLOURS[0] });
  const total = Math.max(income, segments.reduce((a, s) => a + s.value, 0) + (left ?? 0));
  const bar = left !== null && segments.length ? [...segments, { label: "Left over", value: left, colour: "var(--mint)" }] : segments;

  return (
    <section className="card flex flex-col p-6" aria-labelledby="where-title">
      <div className="mb-1 flex items-baseline justify-between gap-3">
        <h2 id="where-title" className="eyebrow">Where you are</h2>
        <p className="hidden truncate text-caption !font-normal text-ink-3 sm:block">{customer.occupation} · {customer.city}</p>
      </div>

      {left !== null ? (
        <p className="mt-2">
          <span className="num block font-display text-[40px] font-semibold leading-none tracking-tight sm:text-[46px]">{formatNaira(shown)}</span>
          <span className="mt-1.5 block text-ink-2">left over each month, on average</span>
        </p>
      ) : (
        <div className="mt-2">
          <p className="mb-1 text-ink-2">Left over each month</p>
          <NotShared />
        </div>
      )}

      <dl className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] bg-surface-2 p-3">
          <dt className="flex items-center gap-1.5 text-caption text-ink-3"><ArrowDownLeft size={14} className="text-green-700" aria-hidden /> Money in</dt>
          <dd className="num mt-0.5 font-semibold">{ctx.income ? formatNaira(ctx.income.average) : <NotShared />}</dd>
        </div>
        <div className="rounded-[14px] bg-surface-2 p-3">
          <dt className="flex items-center gap-1.5 text-caption text-ink-3"><ArrowUpRight size={14} className="text-amber-700" aria-hidden /> Money out</dt>
          <dd className="num mt-0.5 font-semibold">{ctx.spending ? formatNaira(ctx.spending.average) : <NotShared />}</dd>
        </div>
      </dl>

      <div className="mt-5">
        <p className="mb-2 text-small font-medium text-ink-2">Where it goes</p>
        {bar.length && total > 0 ? (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-line" role="img" aria-label={bar.map((s) => `${s.label} ${formatNaira(s.value)}`).join(", ")}>
              {bar.map((s, i) => (
                <span
                  key={s.label}
                  className="h-full origin-left first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${(s.value / total) * 100}%`, background: s.colour, animation: `mm-grow-x 700ms ${150 + i * 80}ms both cubic-bezier(.22,1,.36,1)`, marginRight: i < bar.length - 1 ? 2 : 0 }}
                />
              ))}
            </div>
            <ul className="mt-3 grid grid-cols-1 gap-x-4 gap-y-1.5 text-small sm:grid-cols-2">
              {bar.map((s) => (
                <li key={s.label} className="flex min-w-0 items-center gap-2">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: s.colour }} aria-hidden />
                  <span className="min-w-0 flex-1 truncate text-ink-2">{s.label}</span>
                  <span className="num shrink-0 text-ink-3">{shortNaira(s.value)}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <NotShared />
        )}
      </div>

      <div className="mt-5 border-t border-line pt-4">
        <p className="mb-2 text-small font-medium text-ink-2">Your Zenith products</p>
        {ctx.holdings ? (
          <span className="flex flex-wrap gap-1.5">
            {ctx.holdings.map((h) => (
              <span key={h} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-small text-ink-2 ring-1 ring-line">{HOLDING_LABELS[h]}</span>
            ))}
          </span>
        ) : (
          <NotShared />
        )}
      </div>
    </section>
  );
}
