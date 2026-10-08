import { ArrowRight, CheckCircle2, Flag, Footprints, PauseCircle } from "lucide-react";
import { useStore } from "../../app/providers/store";
import { FinancialSnapshot } from "../../components/cards/FinancialSnapshot";
import { MapJourney } from "../../components/cards/MapJourney";
import { GoalCard } from "../../components/goals/GoalCard";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { EmptyState } from "../../components/shared/States";
import { goalPlan } from "../../engine/plan";
import { useEngineResult } from "../../services/recommendation";
import { formatNaira, greeting } from "../../utils/format";

/** The MoneyMap screen (Phase 2 §4): where you are → your next move → where you're going. */
export function DashboardPage() {
  const { customer, activeGoal } = useStore();
  const result = useEngineResult();
  const ctx = result.context;
  const surplus = ctx.surplus?.average ?? null;
  const plan = activeGoal ? goalPlan(activeGoal, surplus) : null;

  const nowLabel = ctx.surplus
    ? `${formatNaira(Math.max(0, ctx.surplus.average))} left each month`
    : ctx.income
      ? `${formatNaira(ctx.income.average)} monthly income`
      : "Not shared yet";

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-navy-500">{greeting()}, {customer.firstName}</p>
        <h1>Your MoneyMap</h1>
      </header>

      <section className="card p-4 md:p-6" aria-labelledby="journey-title">
        <h2 id="journey-title" className="sr-only">You are here, next move, your goal</h2>
        <MapJourney
          now={nowLabel}
          next={result.top ? result.top.product.name : "Nothing needed now"}
          goal={activeGoal ? activeGoal.label : "Set a goal"}
          progress={plan?.progressPct}
        />
      </section>

      <section aria-labelledby="next-title" className="fade-up">
        <p id="next-title" className="eyebrow mb-3 flex items-center gap-2"><Footprints size={14} aria-hidden /> Your next move</p>
        {result.status === "recommended" && result.top && result.explanation ? (
          <div className="rounded-[24px] border border-mist bg-white p-6 md:p-8">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Badge tone="green" icon={<CheckCircle2 size={14} aria-hidden />}>Strong match</Badge>
              <Badge>{result.top.score}% match</Badge>
            </div>
            <h3 className="mb-2 !text-[22px]">{result.top.product.name}</h3>
            <p className="mb-6 max-w-2xl text-navy-700">{result.explanation.whyItFits}</p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/app/recommendation" iconRight={<ArrowRight size={20} aria-hidden />}>See why</ButtonLink>
              <ButtonLink to={`/app/products/${result.top.product.product_id}`} variant="secondary">View product</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="card p-6 md:p-8">
            <div className="mb-2 flex items-center gap-2">
              {result.status === "paused" || result.status === "window_cap" ? (
                <PauseCircle size={24} className="text-navy-500" aria-hidden />
              ) : (
                <CheckCircle2 size={24} className="text-green-700" aria-hidden />
              )}
              <h3>Nothing needs your attention.</h3>
            </div>
            <p className="mb-1 max-w-2xl text-navy-700">{result.message}</p>
            <p className="mb-6 max-w-2xl text-navy-500">We'll let you know when something genuinely relevant comes up.</p>
            <div className="flex flex-wrap gap-3">
              <ButtonLink to="/app/map">See how MoneyMap decided</ButtonLink>
              <ButtonLink to="/app/products" variant="secondary">Explore products myself</ButtonLink>
            </div>
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.3fr_1fr]">
        <FinancialSnapshot ctx={ctx} customer={customer} />
        {activeGoal ? (
          <GoalCard goal={activeGoal} surplus={surplus} />
        ) : (
          <EmptyState
            icon={Flag}
            title="Give your money somewhere to go."
            body="Tell MoneyMap what you're working towards and we'll help you find the financial path that fits."
            actions={<ButtonLink to="/app/goals">Set a goal</ButtonLink>}
          />
        )}
      </div>
    </div>
  );
}
