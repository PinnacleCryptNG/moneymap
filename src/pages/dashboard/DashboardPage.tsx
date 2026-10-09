import { ArrowRight, BellRing, CheckCircle2, Flag, Footprints, PauseCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { MoneySummary } from "../../components/cards/MoneySummary";
import { RouteChart } from "../../components/charts/RouteChart";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { ScoreRing } from "../../components/shared/ScoreRing";
import { EmptyState } from "../../components/shared/States";
import { goalPlan } from "../../engine/plan";
import { useEngineResult } from "../../services/recommendation";
import { greeting } from "../../utils/format";

/** The MoneyMap screen (Phase 2 §4): where you are → your next move → where you're going. */
export function DashboardPage() {
  const { customer, activeGoal, state, dispatch } = useStore();
  const message = state.notifications.find((n) => !n.read_at);
  const result = useEngineResult();
  const ctx = result.context;
  const surplus = ctx.surplus?.average ?? null;
  const plan = activeGoal ? goalPlan(activeGoal, surplus) : null;


  return (
    <div className="flex flex-col gap-5">
      <header className="fade-up">
        <p className="mb-1 text-ink-3">{greeting()}, {customer.firstName}</p>
        <h1>Your <span className="accent-serif">MoneyMap</span></h1>
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

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr]">
        <section aria-labelledby="next-title" className="fade-up flex flex-col">
          {result.status === "recommended" && result.top && result.explanation ? (
            <div className="card relative flex flex-1 flex-col overflow-hidden p-6 md:p-7">
              <span className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-mint/15 blur-3xl" aria-hidden />
              <p id="next-title" className="eyebrow mb-4 flex items-center gap-2"><Footprints size={14} aria-hidden /> Your next move</p>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <Badge tone="green" icon={<CheckCircle2 size={14} aria-hidden />}>Strong match</Badge>
                  <h3 className="mt-3 !text-[28px] !font-semibold !tracking-tight">{result.top.product.name}</h3>
                </div>
                <ScoreRing value={result.top.score} size={72} />
              </div>
              <p className="mt-2 max-w-prose text-ink-2">{result.explanation.whyItFits}</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <ButtonLink to="/app/recommendation" iconRight={<ArrowRight size={20} aria-hidden />}>See why</ButtonLink>
                <ButtonLink to={`/app/products/${result.top.product.product_id}`} variant="secondary">View product</ButtonLink>
              </div>
            </div>
          ) : (
            <div className="card flex flex-1 flex-col p-6 md:p-7">
              <p id="next-title" className="eyebrow mb-4 flex items-center gap-2"><Footprints size={14} aria-hidden /> Your next move</p>
              <div className="mb-2 flex items-center gap-2">
                {result.status === "paused" || result.status === "window_cap" ? (
                  <PauseCircle size={24} className="text-ink-3" aria-hidden />
                ) : (
                  <CheckCircle2 size={24} className="text-green-700" aria-hidden />
                )}
                <h3>Nothing needs your attention.</h3>
              </div>
              <p className="max-w-prose text-ink-2">{result.message}</p>
              <p className="mt-1 max-w-prose text-ink-3">We'll let you know when something genuinely relevant comes up.</p>
              <div className="mt-auto flex flex-wrap gap-3 pt-6">
                <ButtonLink to="/app/map">See how MoneyMap decided</ButtonLink>
                <ButtonLink to="/app/products" variant="secondary">Explore products myself</ButtonLink>
              </div>
            </div>
          )}
        </section>
        <div className="fade-up" style={{ animationDelay: "90ms" }}>
          <MoneySummary ctx={ctx} customer={customer} />
        </div>
      </div>

      <section aria-labelledby="route-title" className="fade-up" style={{ animationDelay: "160ms" }}>
        <div className="mb-3 flex items-end justify-between gap-3">
          <h2 id="route-title" className="eyebrow flex items-center gap-2"><Flag size={14} aria-hidden /> Your route</h2>
          <Link to="/app/goals" className="text-small font-medium text-blue-600 underline-offset-2 hover:underline">{activeGoal ? "Edit goal" : "Set a goal"}</Link>
        </div>
        {activeGoal && plan ? (
          <RouteChart
            key={activeGoal.id}
            target={plan.target}
            saved={plan.saved}
            surplus={surplus}
            timelineMonths={plan.timelineMonths}
            goalLabel={activeGoal.label}
            nextMove={result.top?.product.name ?? null}
          />
        ) : (
          <EmptyState
            icon={Flag}
            title="Give your money somewhere to go."
            body="Tell MoneyMap what you're working towards and we'll draw your route."
            actions={<ButtonLink to="/app/goals">Set a goal</ButtonLink>}
          />
        )}
      </section>
    </div>
  );
}
