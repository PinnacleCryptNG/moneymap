import { CheckCircle2, PauseCircle } from "lucide-react";
import type { EngineResult } from "../../engine";
import { Button, ButtonLink } from "../shared/Button";

export function NoMatchState({ result, onShowMore }: { result: EngineResult; onShowMore?: () => void }) {
  const capped = result.status === "paused" || result.status === "window_cap";
  const hasPotential = result.ranked.some((e) => e.band === "potential");
  return (
    <section className="card fade-up px-6 py-10 text-center md:px-12 md:py-14" aria-labelledby="nomatch-title">
      <span className={`mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full ${capped ? "bg-cloud text-navy-500" : "bg-green-50 text-green-700"}`}>
        {capped ? <PauseCircle size={32} aria-hidden /> : <CheckCircle2 size={32} aria-hidden />}
      </span>
      <h1 id="nomatch-title" className="mb-3">Nothing needs your attention right now.</h1>
      <p className="mx-auto mb-2 max-w-xl text-body-lg text-navy-700">
        {capped
          ? "We're holding back on purpose."
          : "We checked your current financial context and couldn't find a product that would meaningfully improve your situation right now."}
      </p>
      <p className="mx-auto mb-8 max-w-xl text-navy-500"><span className="font-semibold text-navy-700">Why? </span>{result.message}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <ButtonLink to="/app/map">View my financial map</ButtonLink>
        <ButtonLink to="/app/products" variant="secondary">Explore products myself</ButtonLink>
        {onShowMore && (capped || hasPotential) && (
          <Button variant="tertiary" onClick={onShowMore}>Show me other options anyway</Button>
        )}
      </div>
    </section>
  );
}
