import { ArrowRight, BellRing, CheckCircle2, Flag, Footprints, PauseCircle } from "lucide-react";
import { useStore } from "../../app/providers/store";
import { FinancialSnapshot } from "../../components/cards/FinancialSnapshot";
import { MapJourney } from "../../components/cards/MapJourney";
import { GoalCard } from "../../components/goals/GoalCard";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { ScoreRing } from "../../components/shared/ScoreRing";
import { EmptyState } from "../../components/shared/States";
import { goalPlan } from "../../engine/plan";
import { useEngineResult } from "../../services/recommendation";
import { formatNaira, greeting } from "../../utils/format";

/** The MoneyMap screen (Phase 2 §4): where you are → your next move → where you're going. */
export function DashboardPage() {
  const { customer, activeGoal, state, dispatch } = useStore();
  const message = state.notifications.find((n) => !n.read_at);
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
      <header className="fade-up">
        <p className="mb-1 font-medium text-ink-3">{greeting()}, {customer.firstName} 👋</p>
        <h1>Your MoneyMap</h1>
      </header>

      {message && (
        <section aria-label="New message" className="fade-up flex flex-col gap-3 rounded-[20px] border border-blue/30 bg-blue-50 p-4 sm:flex-row sm:items-center sm:justify-between md:p-5">
          <div className="flex min-w-0 gap-3">
            <BellRing size={22} className="mt-0.5 shrink-0 text-blue-600" aria-hidden />
            <div className="min-w-0">
              <p className="font-semibold">{message.title}</p>
              <p className="text-small text-ink-2">{message.body}</p>
            </div>
          </div>
          <ButtonLink size="sm" to="/app/recommendation" className="shrink-0" onClick={() => dispatch({ type: "read_notification", id: message.id })}>
            See why
          </ButtonLink>
        </section>
      )}

      <section aria-labelledby="journey-title">
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
          <div className="card relative overflow-hidden p-6 md:p-8">
            <span className="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-mint to-blue" aria-hidden />
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge tone="green" icon={<CheckCircle2 size={14} aria-hidden />}>Strong match</Badge>
                  <Badge>{result.top.score}% match</Badge>
                </div>
                <h3 className="mb-2 !text-[26px] !font-extrabold">{result.top.product.name}</h3>
                <p className="max-w-2xl text-ink-2">{result.explanation.whyItFits}</p>
              </div>
              <div className="sm:hidden"><ScoreRing value={result.top.score} size={60} /></div>
              <div className="hidden sm:block"><ScoreRing value={result.top.score} size={84} /></div>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <ButtonLink to="/app/recommendation" iconRight={<ArrowRight size={20} aria-hidden />}>See why</ButtonLink>
              <ButtonLink to={`/app/products/${result.top.product.product_id}`} variant="secondary">View product</ButtonLink>
            </div>
          </div>
        ) : (
          <div className="card p-6 md:p-8">
            <div className="mb-2 flex items-center gap-2">
              {result.status === "paused" || result.status === "window_cap" ? (
                <PauseCircle size={24} className="text-ink-3" aria-hidden />
              ) : (
                <CheckCircle2 size={24} className="text-green-700" aria-hidden />
              )}
              <h3>Nothing needs your attention.</h3>
            </div>
            <p className="mb-1 max-w-2xl text-ink-2">{result.message}</p>
            <p className="mb-6 max-w-2xl text-ink-3">We'll let you know when something genuinely relevant comes up.</p>
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
