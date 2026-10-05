import { Activity, ArrowRight, Briefcase, CreditCard, Gauge, Lock, PiggyBank, Radar, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { useStore } from "../../app/providers/store";
import { InsightCard } from "../../components/cards/InsightCard";
import { MapJourney } from "../../components/cards/MapJourney";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { PageHeader } from "../../components/shared/PageHeader";
import { NEED_LABELS, THRESHOLDS } from "../../engine";
import { goalPlan } from "../../engine/plan";
import { PERMISSION_COPY } from "../../services/consent";
import { useEngineResult } from "../../services/recommendation";
import type { Signal } from "../../types";
import { formatNaira } from "../../utils/format";

const SIGNAL_META: Record<Signal, { title: string; icon: typeof Activity; tone: "blue" | "green" | "amber" }> = {
  consistent_income: { title: "Consistent income", icon: Wallet, tone: "green" },
  irregular_income: { title: "Variable income", icon: Activity, tone: "amber" },
  income_increase: { title: "Income increase", icon: TrendingUp, tone: "green" },
  regular_surplus: { title: "Regular surplus", icon: PiggyBank, tone: "green" },
  low_surplus: { title: "Tight cash flow", icon: TrendingDown, tone: "amber" },
  stated_savings_goal: { title: "Savings goal", icon: PiggyBank, tone: "blue" },
  savings_in_everyday_account: { title: "Savings mixed with spending", icon: Wallet, tone: "amber" },
  repeated_saving_behaviour: { title: "Repeated saving", icon: PiggyBank, tone: "green" },
  planned_major_expense: { title: "Planned expense", icon: Wallet, tone: "blue" },
  business_inflows: { title: "Business inflows", icon: Briefcase, tone: "blue" },
  business_growth: { title: "Business growth", icon: TrendingUp, tone: "green" },
  high_transaction_volume: { title: "High transaction volume", icon: Activity, tone: "blue" },
  high_card_spend: { title: "Card-first spending", icon: CreditCard, tone: "blue" },
  no_emergency_buffer: { title: "Thin safety buffer", icon: Gauge, tone: "amber" },
  needs_immediate_liquidity: { title: "Money needed soon", icon: Gauge, tone: "amber" },
  large_idle_balance: { title: "Idle balance", icon: Wallet, tone: "blue" },
};

export function MapPage() {
  const { activeGoal } = useStore();
  const result = useEngineResult();
  const { context: ctx, needs, ranked } = result;
  const plan = activeGoal ? goalPlan(activeGoal, ctx.surplus?.average ?? null) : null;
  const evaluated = ranked.length;
  const passed = ranked.filter((e) => !e.exclusion).length;
  const above = ranked.filter((e) => !e.exclusion && e.score >= THRESHOLDS.potential).length;
  const missing = (Object.keys(ctx.permissions) as (keyof typeof ctx.permissions)[]).filter((k) => !ctx.permissions[k]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Your financial map" title="Where you are, and where you could go" body="What MoneyMap understands from the information you've allowed — the signals, the needs they point to, and how products were filtered." />

      <section className="card p-4 md:p-6">
        <MapJourney
          now={ctx.surplus ? `${formatNaira(ctx.surplus.average)} monthly surplus` : "Context not shared"}
          next={result.top?.product.name ?? null}
          goal={activeGoal?.label ?? "Set a goal"}
          progress={plan?.progressPct}
        />
      </section>

      {missing.length > 0 && (
        <div className="flex flex-col gap-3 rounded-[16px] border border-mist bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-start gap-2 text-small text-navy-700">
            <Lock size={18} className="mt-0.5 shrink-0 text-navy-500" aria-hidden />
            Not shared: {missing.map((k) => PERMISSION_COPY[k].title).join(", ")}. MoneyMap isn't using these — that's your choice.
          </p>
          <ButtonLink to="/app/settings" size="sm" variant="secondary">Review permissions</ButtonLink>
        </div>
      )}

      <section aria-labelledby="signals-title">
        <h2 id="signals-title" className="mb-3">What your money is telling us</h2>
        {ctx.signals.length === 0 ? (
          <p className="card p-5 text-navy-500">No signals yet — MoneyMap needs at least some permitted information to understand your patterns.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {ctx.signals.map((s) => {
              const m = SIGNAL_META[s.signal];
              return (
                <InsightCard
                  key={s.signal}
                  icon={m.icon}
                  tone={m.tone}
                  title={m.title}
                  body={s.evidence}
                  meta={<span className="text-caption !font-normal text-navy-500">Source: {PERMISSION_COPY[s.source].title} · confidence {Math.round(s.strength * 100)}%</span>}
                />
              );
            })}
          </div>
        )}
      </section>

      <section aria-labelledby="needs-title" className="card p-5 md:p-6">
        <h2 id="needs-title" className="mb-1 !text-[20px]">Needs detected</h2>
        <p className="mb-4 text-small text-navy-500">The need comes before the product.</p>
        {needs.length === 0 ? (
          <p className="text-navy-500">No strong financial need detected right now.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {needs.map((n) => (
              <li key={n.need}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <span className="font-medium">{NEED_LABELS[n.need]}</span>
                  <span className="text-small tabular-nums text-navy-500">{n.strength}/100</span>
                </div>
                <div className="mb-1 h-2 overflow-hidden rounded-full bg-mist" role="img" aria-label={`Strength ${n.strength} out of 100`}>
                  <div className="h-full rounded-full bg-blue" style={{ width: `${n.strength}%` }} />
                </div>
                <p className="text-small text-navy-500">{n.reasons.join(" ")}</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="funnel-title" className="card p-5 md:p-6">
        <h2 id="funnel-title" className="mb-1 flex items-center gap-2 !text-[20px]"><Radar size={22} className="text-blue" aria-hidden /> How MoneyMap decided</h2>
        <p className="mb-5 text-small text-navy-500">From the whole catalogue down to one recommendation — or none.</p>
        <ol className="grid gap-3 sm:grid-cols-4">
          {[
            { n: evaluated, label: "Products evaluated" },
            { n: passed, label: "Passed eligibility & hard rules" },
            { n: above, label: `Scored ${THRESHOLDS.potential}+` },
            { n: result.top ? 1 : 0, label: result.top ? "Recommended" : "Recommended — no strong match" },
          ].map((s, i) => (
            <li key={s.label} className="relative rounded-[12px] bg-cloud p-4">
              <p className="text-[28px] font-bold leading-9 tabular-nums">{s.n}</p>
              <p className="text-small text-navy-500">{s.label}</p>
              {i < 3 && <ArrowRight size={16} className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-navy-500 sm:block" aria-hidden />}
            </li>
          ))}
        </ol>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {result.top ? (
            <>
              <Badge tone="green">{result.top.product.name} · {result.top.score}%</Badge>
              <ButtonLink to="/app/recommendation" size="sm">See recommendation</ButtonLink>
            </>
          ) : (
            <>
              <Badge>No recommendation</Badge>
              <ButtonLink to="/app/products" size="sm" variant="secondary">Explore products myself</ButtonLink>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
