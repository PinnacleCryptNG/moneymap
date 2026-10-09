import { useStore } from "../../app/providers/store";
import { PageHeader } from "../../components/shared/PageHeader";
import { CATEGORY_FATIGUE_LIMIT, DECISION_WINDOW_DAYS, FATIGUE_LIMIT, FATIGUE_WINDOW_DAYS, MODEL_VERSION, THRESHOLDS, WEIGHTS, runEngine, toApiResponse } from "../../engine";
import { ENDPOINTS } from "../../services/api";
import { API_MODE } from "../../services/http";
import { useEngineInput } from "../../services/recommendation";

const WEIGHT_LABELS: Record<keyof typeof WEIGHTS, string> = {
  needFit: "Need fit",
  goalFit: "Goal fit",
  behaviourFit: "Behaviour fit",
  eligibilityFit: "Eligibility",
  timingFit: "Timing",
  preferenceFit: "Customer preference",
};

export function AdminEnginePage() {
  const { customer } = useStore();
  const input = useEngineInput();
  const result = runEngine(input);
  const sample = toApiResponse(result, "REC_PREVIEW", customer.id);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Decision engine" title="Engine & rules" body={`Phase 1: rules + weighted scoring. Model ${MODEL_VERSION}. Weights and thresholds are prototype values to be validated with historical data and controlled testing before production.`} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card p-5 md:p-6" aria-labelledby="w-title">
          <h2 id="w-title" className="mb-4 !text-[20px]">MVP scoring weights</h2>
          <table className="w-full text-small">
            <tbody className="divide-y divide-line">
              {(Object.keys(WEIGHTS) as (keyof typeof WEIGHTS)[]).map((k) => (
                <tr key={k}>
                  <th scope="row" className="py-2.5 text-left font-medium">{WEIGHT_LABELS[k]}</th>
                  <td className="w-1/2 py-2.5"><div className="h-2 overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-blue" style={{ width: `${WEIGHTS[k] * 100 / 0.3}%` }} /></div></td>
                  <td className="py-2.5 text-right font-semibold tabular-nums">{Math.round(WEIGHTS[k] * 100)}%</td>
                </tr>
              ))}
              <tr><th scope="row" className="py-2.5 text-left font-medium">− Irrelevance penalty</th><td colSpan={2} className="py-2.5 text-right text-ink-3">25 per conflicting signal; 40 if no detected need</td></tr>
              <tr><th scope="row" className="py-2.5 text-left font-medium">− Overexposure penalty</th><td colSpan={2} className="py-2.5 text-right text-ink-3">10 if shown 2+ times in {DECISION_WINDOW_DAYS} days</td></tr>
            </tbody>
          </table>
          <h3 className="mb-2 mt-6 !text-[16px]">Thresholds</h3>
          <ul className="text-small text-ink-2">
            <li><strong>{THRESHOLDS.strong}–100</strong> Strong match — may be shown proactively</li>
            <li><strong>{THRESHOLDS.potential}–{THRESHOLDS.strong - 1}</strong> Potential — only with additional context or on request</li>
            <li><strong>Below {THRESHOLDS.potential}</strong> Do not actively recommend</li>
          </ul>
        </section>

        <section className="card p-5 md:p-6" aria-labelledby="h-title">
          <h2 id="h-title" className="mb-4 !text-[20px]">Hard rules (override any score)</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-small text-ink-2">
            <li>Product is inactive</li>
            <li>Customer has opted out of the category</li>
            <li>Customer said “I don't want this”</li>
            <li>Customer already holds the product (SAVE4ME allows one per goal)</li>
            <li>A published eligibility condition fails (e.g. student-only, age range, salary account)</li>
            <li>A MoneyMap guardrail fails (repayment affordability, balance cap below the goal)</li>
            <li>Customer recently said “Not relevant”</li>
            <li>Product conflicts with the stated need (e.g. locks funds needed soon)</li>
            <li>Customer asked to be reminded later (snoozed)</li>
          </ul>
          <h3 className="mb-2 mt-6 !text-[16px]">Over-marketing control</h3>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-small text-ink-2">
            <li>Max 1 proactive recommendation per {DECISION_WINDOW_DAYS}-day decision window unless the customer asks</li>
            <li>{FATIGUE_LIMIT}+ dismissals in {FATIGUE_WINDOW_DAYS} days → stop recommending (fatigue)</li>
            <li>{CATEGORY_FATIGUE_LIMIT}+ dismissals in a category → pause that category</li>
            <li>“Not relevant” → product timing set to “not now” for {FATIGUE_WINDOW_DAYS} days</li>
            <li>Default frequency: only when highly relevant</li>
          </ul>
        </section>
      </div>

      <section className="card p-5 md:p-6" aria-labelledby="api-title">
        <h2 id="api-title" className="mb-1 !text-[20px]">Recommendation API</h2>
        <p className="mb-4 text-small text-ink-3">
          Response shape for the current demo customer ({customer.firstName}) — <code>POST /api/v1/recommendations</code>.{" "}
          {API_MODE ? (
            <a href="/docs" target="_blank" rel="noreferrer" className="font-semibold text-blue-600 hover:underline">Open the live API docs →</a>
          ) : (
            "Run the MoneyMap server (npm start) to call these endpoints for real; docs at /docs."
          )}
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.4fr]">
          <ul className="font-mono text-[13px] leading-6 text-ink-2">
            {ENDPOINTS.map((e) => <li key={e}>{e}</li>)}
          </ul>
          <pre className="max-h-96 overflow-auto rounded-[12px] bg-night p-4 text-[13px] leading-5 text-white/80"><code>{JSON.stringify(sample, null, 2)}</code></pre>
        </div>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="arch-title">
        <h2 id="arch-title" className="mb-3 !text-[20px]">How it's built</h2>
        <ol className="grid grid-cols-1 gap-3 text-small md:grid-cols-5">
          {[
            ["Customer app", "React + TypeScript. Consent, goals, MoneyMap screen, recommendation, explanation, feedback."],
            ["API layer", "One function per REST endpoint (POST /api/v1/recommendations, …). The seam where a Node/PostgreSQL backend plugs in."],
            ["Decision engine", "Pure TypeScript, no UI: Understand → Detect → Match → Decide → Explain. Fully unit-tested."],
            ["Catalogue", "Six Zenith products: published facts with sources, published eligibility, MoneyMap guardrails, matching rules."],
            ["Records", "Consent log, recommendation records (customer, product, need, score, reasons, timing, eligibility), feedback, audit log."],
          ].map(([t, d], i) => (
            <li key={t} className="rounded-[12px] bg-canvas p-3">
              <p className="mb-1 font-semibold">{i + 1}. {t}</p>
              <p className="text-ink-2">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="card p-5 md:p-6" aria-labelledby="gov-title">
        <h2 id="gov-title" className="mb-2 !text-[20px]">Governance</h2>
        <p className="text-small text-ink-2">
          Recommendations are grounded only in approved catalogue data — no generated product terms. Relevance scoring is separate from commercial value. The engine never approves credit or replaces formal eligibility, underwriting or compliance systems. Protected attributes are never used as proxies for suitability. Feedback is stored for quality analysis; models are never retrained automatically from single interactions. Every recommendation carries a model version and an audit record.
        </p>
      </section>
    </div>
  );
}
