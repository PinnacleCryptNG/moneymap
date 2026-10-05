import { ArrowRight, CalendarClock, CircleHelp, ListChecks, Sparkles } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { FeedbackControl } from "../../components/recommendations/FeedbackControl";
import { MatchScore } from "../../components/recommendations/MatchScore";
import { NoMatchState } from "../../components/recommendations/NoMatchState";
import { ReasonList } from "../../components/recommendations/ReasonList";
import { consideredAlternatives, WhyNotList } from "../../components/recommendations/WhyNotList";
import { Badge } from "../../components/shared/Badge";
import { Button, ButtonLink } from "../../components/shared/Button";
import { BottomSheet } from "../../components/shared/Modal";
import { ErrorState, LoadingPanel } from "../../components/shared/States";
import { useToast } from "../../components/shared/Toast";
import { useRecommendation } from "../../services/recommendation";
import type { FeedbackType } from "../../types";
import { CATEGORY_META } from "../../utils/labels";

const FEEDBACK_TOAST: Record<FeedbackType, string> = {
  useful: "Thanks — glad this helped.",
  not_relevant: "Got it. We'll use this to improve what we show you.",
  dont_understand: "Thanks. We've opened the full explanation for you.",
  dont_want: "Understood. We won't recommend this product again.",
  remind_later: "We'll check back in a few days.",
};

export function RecommendationPage() {
  const [params, setParams] = useSearchParams();
  const more = params.get("more") === "1";
  const { result, error, loading, retry, record } = useRecommendation(more);
  const { dispatch } = useStore();
  const toast = useToast();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (loading && !result) return <LoadingPanel />;
  if (error) return <ErrorState onRetry={retry} />;
  if (!result) return null;

  const showMore = () => setParams({ more: "1" });

  if (!result.top || !result.explanation) {
    return <NoMatchState result={result} onShowMore={more ? undefined : showMore} />;
  }

  const { top, explanation } = result;
  const Icon = CATEGORY_META[top.product.category].icon;
  const alternatives = consideredAlternatives(result.ranked, top.product.product_id);
  const whyHref = `/app/recommendation/why${more ? "?more=1" : ""}`;

  const giveFeedback = (f: FeedbackType) => {
    if (!record) return;
    dispatch({ type: "feedback", id: record.id, feedback: f });
    toast(FEEDBACK_TOAST[f]);
    setSheetOpen(false);
    if (f === "dont_understand") navigate(whyHref);
  };

  const dismissed = record?.status === "dismissed" || record?.status === "snoozed";

  return (
    <div className="flex flex-col gap-6">
      <header className="fade-up">
        <p className="eyebrow mb-1 !text-green-700">Your money has a direction</p>
        <h1>{more ? "Here's another option to consider." : "We found a better fit for your goal."}</h1>
        <p className="mt-2 max-w-2xl text-navy-500">
          Based on your goals and the information you've permitted us to use, here's what makes the most sense right now.
        </p>
      </header>

      {dismissed && (
        <div role="status" className="rounded-[16px] border border-mist bg-white p-4 text-small">
          <p className="mb-2 font-semibold">
            {record?.status === "snoozed" ? "We'll remind you about this later." : "You dismissed this recommendation."}
          </p>
          <p className="mb-3 text-navy-500">MoneyMap won't push something else straight away — it limits proactive suggestions to avoid over-marketing.</p>
          <Button size="sm" variant="secondary" onClick={retry}>Check my map again</Button>
        </div>
      )}

      <section className="fade-up overflow-hidden rounded-[24px] border border-mist bg-white" aria-labelledby="rec-title">
        <div className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:p-8">
          <div>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <Badge tone="navy" icon={<Sparkles size={14} aria-hidden />}>Recommended</Badge>
              <Badge>{CATEGORY_META[top.product.category].label}</Badge>
              {top.band === "potential" && <Badge tone="amber">Potential match — shown because you asked</Badge>}
            </div>
            <div className="mb-2 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-blue-50 text-blue"><Icon size={24} aria-hidden /></span>
              <h2 id="rec-title">{top.product.name}</h2>
            </div>
            <p className="text-navy-700">{top.product.description}</p>
          </div>
          <div className="flex flex-col gap-5 md:min-w-64">
            <MatchScore score={top.score} band={top.band} />
            <ReasonList items={top.basis} />
          </div>
        </div>

        <div className="grid gap-px border-t border-mist bg-mist md:grid-cols-2">
          <div className="bg-white p-6 md:p-8">
            <h3 className="mb-2 flex items-center gap-2"><CircleHelp size={20} className="text-blue" aria-hidden /> Why we're recommending this</h3>
            <p className="text-navy-700">{explanation.summary}</p>
            {explanation.estimate && (
              <div className="mt-4 rounded-[12px] bg-cloud p-4">
                <p className="mb-2 text-caption uppercase tracking-wide text-navy-500">Estimate — for guidance only</p>
                <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {explanation.estimate.map((e) => (
                    <div key={e.label}>
                      <dt className="text-small text-navy-500">{e.label}</dt>
                      <dd className="font-semibold tabular-nums">{e.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>
          <div className="flex flex-col gap-6 bg-white p-6 md:p-8">
            <div>
              <h3 className="mb-2 flex items-center gap-2"><CalendarClock size={20} className="text-blue" aria-hidden /> Why now?</h3>
              <p className="text-navy-700">{top.timing.reason}</p>
            </div>
            <div>
              <h3 className="mb-3 flex items-center gap-2"><ListChecks size={20} className="text-blue" aria-hidden /> What happens next?</h3>
              <ol className="flex flex-col gap-2">
                {explanation.nextSteps.map((s, i) => (
                  <li key={s} className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-50 text-small font-semibold text-blue-600">{i + 1}</span>
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-mist p-6 md:px-8">
          <ButtonLink
            to={`/app/products/${top.product.product_id}`}
            onClick={() => record && dispatch({ type: "set_recommendation_status", id: record.id, status: "explored" })}
            iconRight={<ArrowRight size={20} aria-hidden />}
          >
            Explore product
          </ButtonLink>
          <Button variant="secondary" onClick={() => setSheetOpen(true)}>Not interested</Button>
          <Link to={whyHref} className="ml-auto inline-flex min-h-11 items-center gap-1 font-semibold text-blue-600 hover:underline">
            Why this? <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
      </section>

      {alternatives.length > 0 && (
        <section className="card p-6" aria-labelledby="alts-title">
          <h3 id="alts-title" className="mb-1">Other options considered</h3>
          <p className="mb-4 text-small text-navy-500">MoneyMap evaluated {result.ranked.length} products. Here's why these weren't chosen.</p>
          <WhyNotList items={alternatives} limit={3} />
          <Link to={whyHref} className="mt-4 inline-flex min-h-11 items-center gap-1 text-small font-semibold text-blue-600 hover:underline">
            See the full evaluation <ArrowRight size={16} aria-hidden />
          </Link>
        </section>
      )}

      <section className="card p-6">
        <FeedbackControl value={record?.feedback} onSelect={giveFeedback} />
      </section>

      <p className="text-caption !font-normal text-navy-500">
        Prototype: product names and terms are illustrative and are not actual Zenith product terms. MoneyMap does not approve credit or open accounts — final decisions follow the bank's formal checks. Model {result.modelVersion}.
      </p>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Tell us why">
        <p className="mb-4 text-navy-500">Your answer shapes what MoneyMap shows you next.</p>
        <div className="flex flex-col gap-2">
          {(
            [
              ["not_relevant", "Not relevant to me"],
              ["dont_want", "I don't want this product"],
              ["remind_later", "Remind me later"],
              ["dont_understand", "I don't understand it"],
            ] as [FeedbackType, string][]
          ).map(([k, label]) => (
            <Button key={k} variant="ghost" className="justify-start" onClick={() => giveFeedback(k)}>{label}</Button>
          ))}
        </div>
      </BottomSheet>
    </div>
  );
}
