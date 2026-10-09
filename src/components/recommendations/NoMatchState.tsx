import { CheckCircle2, PauseCircle } from "../icons";
import type { EngineResult } from "../../engine";
import { Button, ButtonLink } from "../shared/Button";
import { EnginePipeline } from "./EnginePipeline";
import { consideredAlternatives, WhyNotList } from "./WhyNotList";

/** A first-class product state (Phase 2 §8): MoneyMap does not invent a recommendation. */
export function NoMatchState({ result, onShowMore }: { result: EngineResult; onShowMore?: () => void }) {
  const capped = result.status === "paused" || result.status === "window_cap";
  const hasPotential = result.ranked.some((e) => e.band === "potential");
  const checked = consideredAlternatives(result.ranked);
  return (
    <div className="flex flex-col gap-6">
      <section className="card fade-up px-6 py-10 text-center md:px-12 md:py-12" aria-labelledby="nomatch-title">
        <span className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${capped ? "bg-canvas text-ink-3" : "bg-green-50 text-green-700"}`}>
          {capped ? <PauseCircle size={32} aria-hidden /> : <CheckCircle2 size={32} aria-hidden />}
        </span>
        <h1 id="nomatch-title" className="mb-3">Nothing needs your attention.</h1>
        <p className="mx-auto mb-2 max-w-xl text-body-lg text-ink-2">
          {capped
            ? "We're holding back on purpose."
            : "We didn't find a financial product that meaningfully fits your current situation right now."}
        </p>
        <p className="mx-auto mb-2 max-w-xl text-ink-3">{result.message}</p>
        <p className="mx-auto mb-8 max-w-xl font-medium text-ink-2">We'll let you know when something genuinely relevant comes up.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <ButtonLink to="/app">Back to my MoneyMap</ButtonLink>
          <ButtonLink to="/app/products" variant="secondary">Explore products myself</ButtonLink>
          {onShowMore && (capped || hasPotential) && (
            <Button variant="tertiary" onClick={onShowMore}>Show me other options anyway</Button>
          )}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[300px_1fr]">
        <section className="card p-5" aria-labelledby="nm-engine">
          <h2 id="nm-engine" className="mb-1 !text-[16px] !leading-6">How MoneyMap decided</h2>
          <p className="mb-4 text-caption !font-normal text-ink-3">Every product was checked. None was strong enough.</p>
          <EnginePipeline steps={result.trace} compact />
        </section>
        {checked.length > 0 && (
          <section className="card p-5 md:p-6" aria-labelledby="nm-checked">
            <h2 id="nm-checked" className="mb-1 !text-[18px] !leading-7">What we checked</h2>
            <p className="mb-4 text-small text-ink-3">Products that relate to your situation, and why none of them made the cut.</p>
            <WhyNotList items={checked} />
          </section>
        )}
      </div>
    </div>
  );
}
