import { ArrowRight, CalendarClock, CircleCheck, Sparkles, Target } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { EnginePipeline } from "../../components/recommendations/EnginePipeline";
import { FeedbackControl } from "../../components/recommendations/FeedbackControl";
import { MatchScore } from "../../components/recommendations/MatchScore";
import { NoMatchState } from "../../components/recommendations/NoMatchState";
import { consideredAlternatives, WhyNotList } from "../../components/recommendations/WhyNotList";
import { Badge } from "../../components/shared/Badge";
import { Button, ButtonLink } from "../../components/shared/Button";
import { ErrorState } from "../../components/shared/States";
import { useToast } from "../../components/shared/Toast";
import { useEngineResult, useRecommendation } from "../../services/recommendation";
import type { FeedbackType } from "../../types";
import { CATEGORY_META } from "../../utils/labels";

const FEEDBACK_TOAST: Record<FeedbackType, string> = {
  useful: "Thanks — glad this helped.",
  not_relevant: "Got it. We won't show this again for now.",
  not_understood: "Thanks. Here's the full explanation.",
  not_wanted: "Understood. We won't recommend this product again.",
  remind_later: "We'll check back with you in a few days.",
};

export function RecommendationPage() {
  const [params, setParams] = useSearchParams();
  const more = params.get("more") === "1";
  const { result, error, loading, retry, record } = useRecommendation(more);
  const preview = useEngineResult(more);
  const { dispatch } = useStore();
  const toast = useToast();
  const navigate = useNavigate();

  if (error) return <ErrorState onRetry={retry} />;
  if (loading && !result) {
    return (
      <section className="card mx-auto max-w-xl p-6 md:p-8" role="status" aria-live="polite">
        <p className="eyebrow mb-1">MoneyMap is checking</p>
        <h1 className="mb-5 !text-[24px] !leading-8">Working out what makes sense for you right now…</h1>
        <EnginePipeline steps={preview.trace} reveal />
      </section>
    );
  }
  if (!result) return null;

  if (!result.top || !result.explanation) {
    return <NoMatchState result={result} onShowMore={more ? undefined : () => setParams({ more: "1" })} />;
  }

  const { top, explanation: ex } = result;
  const Icon = CATEGORY_META[top.product.category].icon;
  const alternatives = consideredAlternatives(result.ranked, top.product.product_id);
  const whyHref = `/app/recommendation/why${more ? "?more=1" : ""}`;
  const dismissed = record?.status === "dismissed" || record?.status === "snoozed";

  const giveFeedback = (f: FeedbackType) => {
    if (!record) return;
    dispatch({ type: "feedback", id: record.id, feedback: f });
    toast(FEEDBACK_TOAST[f]);
    if (f === "not_understood") navigate(whyHref);
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="fade-up">
        <p className="eyebrow mb-1 !text-green-700">Your next move</p>
        <h1>{more ? "Here's another option to consider." : top.band === "strong" ? "We found a strong match." : "We found a possible match."}</h1>
        <p className="mt-2 max-w-2xl text-navy-500">
          Based on your goal and the information you've allowed MoneyMap to use. You decide what happens next.
        </p>
      </header>

      {dismissed && (
        <div role="status" className="rounded-[16px] border border-mist bg-white p-4 text-small">
          <p className="mb-1 font-semibold">{record?.status === "snoozed" ? "We'll remind you about this later." : "You turned this recommendation down."}</p>
          <p className="mb-3 text-navy-500">MoneyMap won't push something else straight away — it limits suggestions to avoid over-marketing.</p>
          <Button size="sm" variant="secondary" onClick={retry}>Check my MoneyMap again</Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
        <section className="fade-up overflow-hidden rounded-[24px] border border-mist bg-white" aria-labelledby="rec-title">
          <div className="flex flex-col gap-5 p-6 md:flex-row md:items-start md:justify-between md:p-8">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap gap-2">
                <Badge tone="navy" icon={<Sparkles size={14} aria-hidden />}>Recommended for you</Badge>
                <Badge>{CATEGORY_META[top.product.category].label}</Badge>
                {top.band === "potential" && <Badge tone="amber">Potential match — shown because you asked</Badge>}
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[12px] bg-blue-50 text-blue"><Icon size={24} aria-hidden /></span>
                <div>
                  <h2 id="rec-title">{top.product.name}</h2>
                  <p className="text-small text-navy-500">Zenith Bank · {top.product.purpose}</p>
                </div>
              </div>
            </div>
            <MatchScore score={top.score} band={top.band} />
          </div>

          <div className="flex flex-col gap-6 border-t border-mist p-6 md:p-8">
            <div>
              <h3 className="mb-1.5 flex items-center gap-2 !text-[18px]"><Target size={20} className="text-blue" aria-hidden /> Why it fits</h3>
              <p className="text-body-lg text-navy-700">{ex.whyItFits}</p>
            </div>
            <div>
              <h3 className="mb-1.5 flex items-center gap-2 !text-[18px]"><CalendarClock size={20} className="text-blue" aria-hidden /> Why now</h3>
              <p className="text-navy-700">{ex.whyNow}</p>
            </div>
            <div>
              <h3 className="mb-3 !text-[18px]">What influenced this</h3>
              <ul className="flex flex-col gap-3">
                {ex.influences.map((i) => (
                  <li key={i.key} className="flex gap-3">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-50 text-green-700"><CircleCheck size={16} aria-hidden /></span>
                    <span>
                      <span className="block font-medium">{i.label}</span>
                      <span className="text-small text-navy-500">{i.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            {ex.estimate && (
              <div className="rounded-[12px] bg-cloud p-4">
                <p className="mb-2 text-caption uppercase tracking-wide text-navy-500">Estimate — for guidance only</p>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {ex.estimate.map((e) => (
                    <div key={e.label}>
                      <dt className="text-small text-navy-500">{e.label}</dt>
                      <dd className="font-semibold tabular-nums">{e.value}</dd>
                    </div>
                  ))}
                </dl>
                {ex.estimateNote && <p className="mt-3 text-caption !font-normal text-navy-500">{ex.estimateNote}</p>}
              </div>
            )}
          </div>

          <div className="border-t border-mist p-6 md:px-8">
            <h3 className="mb-3 !text-[18px]">Your choice</h3>
            <div className="flex flex-wrap items-center gap-3">
              <ButtonLink
                to={`/app/products/${top.product.product_id}`}
                onClick={() => record && dispatch({ type: "set_recommendation_status", id: record.id, status: "explored" })}
                iconRight={<ArrowRight size={20} aria-hidden />}
              >
                View product
              </ButtonLink>
              <Button variant="secondary" disabled={!record || dismissed} onClick={() => giveFeedback("not_relevant")}>Not relevant</Button>
              <Link to={whyHref} className="inline-flex min-h-11 items-center gap-1 font-semibold text-blue-600 hover:underline sm:ml-auto">
                Why this? <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
          </div>
        </section>

        <aside className="flex flex-col gap-6">
          <section className="card p-5" aria-labelledby="engine-title">
            <h3 id="engine-title" className="mb-1 !text-[16px]">How MoneyMap reached this</h3>
            <p className="mb-4 text-caption !font-normal text-navy-500">The real steps and results — nothing here is hand-picked.</p>
            <EnginePipeline steps={result.trace} compact />
          </section>
        </aside>
      </div>

      {alternatives.length > 0 && (
        <section className="card p-6" aria-labelledby="alts-title">
          <h3 id="alts-title" className="mb-1">Other options considered</h3>
          <p className="mb-4 text-small text-navy-500">MoneyMap checked {result.ranked.length} Zenith products. Here's why these weren't chosen.</p>
          <WhyNotList items={alternatives} limit={3} />
        </section>
      )}

      <section className="card p-6">
        <FeedbackControl value={record?.feedback} onSelect={giveFeedback} />
      </section>

      <p className="text-caption !font-normal text-navy-500">
        MoneyMap suggests; it never decides for you, approves credit or opens accounts. Product information comes from public sources and is subject to Zenith Bank's current requirements. Model {result.modelVersion}.
      </p>
    </div>
  );
}
