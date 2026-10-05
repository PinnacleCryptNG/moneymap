import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { NEED_LABELS } from "../../engine";
import { simulateCohort } from "../../services/analytics";
import { FEEDBACK_LABELS } from "../../utils/labels";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

export function AdminOverviewPage() {
  const { state } = useStore();
  const m = useMemo(() => simulateCohort(state.products), [state.products]);
  const live = state.recommendations;
  const liveFeedback = live.filter((r) => r.feedback);

  const kpis = [
    { label: "Useful recommendation rate", value: pct(m.useful, m.recommended), note: "North Star — marked useful", tone: "green" as const },
    { label: "Active customers", value: m.customers.toLocaleString(), note: "Synthetic cohort" },
    { label: "Recommendation volume", value: m.recommended.toLocaleString(), note: `${pct(m.recommended, m.customers)} of customers` },
    { label: "Acceptance", value: pct(m.accepted, m.recommended), note: "Led to meaningful action" },
    { label: "Conversion", value: pct(m.completed, m.recommended), note: "Completed product journeys" },
    { label: "Rejection", value: pct(m.rejected, m.recommended), note: "Not relevant / don't want" },
    { label: "No-match rate", value: pct(m.noMatch, m.customers), note: "Correctly chose not to recommend" },
    { label: "Unexplained recommendations", value: pct(m.unexplained, m.recommended), note: "Target: 0%", tone: m.unexplained ? ("red" as const) : ("green" as const) },
  ];

  const maxRec = Math.max(1, ...m.products.map((p) => p.recommended));
  const maxNeed = Math.max(1, ...m.needs.map((n) => n.count));

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Bank admin"
        title="Recommendation monitoring"
        body="Metrics from the live decision engine run over a deterministic synthetic cohort of anonymised customers. Change the catalogue and these update."
      />

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="sr-only">Overview</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {kpis.map((k) => (
            <div key={k.label} className="card p-4 md:p-5">
              <dt className="text-small text-navy-500">{k.label}</dt>
              <dd className={`text-[28px] font-bold leading-9 tabular-nums ${k.tone === "green" ? "text-green-700" : k.tone === "red" ? "text-red" : ""}`}>{k.value}</dd>
              <dd className="text-caption !font-normal text-navy-500">{k.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="card overflow-x-auto p-5 md:p-6" aria-labelledby="perf-title">
          <h2 id="perf-title" className="mb-4 !text-[20px]">Product performance</h2>
          <table className="w-full min-w-[520px] text-small">
            <thead>
              <tr className="text-left text-navy-500">
                <th scope="col" className="pb-2 font-medium">Product</th>
                <th scope="col" className="w-1/3 pb-2 font-medium">Recommended</th>
                <th scope="col" className="pb-2 pl-3 text-right font-medium">Accepted</th>
                <th scope="col" className="pb-2 pl-3 text-right font-medium">Rejected</th>
                <th scope="col" className="pb-2 pl-3 text-right font-medium whitespace-nowrap">Avg score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {m.products.map((p) => {
                const lowRelevance = p.recommended > 0 && p.rejected / p.recommended > 0.25;
                return (
                  <tr key={p.product.product_id}>
                    <th scope="row" className="py-2.5 pr-2 text-left font-medium">
                      {p.product.name}
                      {p.product.status !== "active" && <span className="ml-2"><Badge>Inactive</Badge></span>}
                      {lowRelevance && <span className="ml-2"><Badge tone="amber">Frequently rejected</Badge></span>}
                    </th>
                    <td className="py-2.5 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-blue" style={{ width: `${(p.recommended / maxRec) * 100}%` }} /></div>
                        <span className="w-8 text-right tabular-nums">{p.recommended}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{pct(p.accepted, p.recommended)}</td>
                    <td className="py-2.5 text-right tabular-nums">{pct(p.rejected, p.recommended)}</td>
                    <td className="py-2.5 text-right tabular-nums">{p.avgScore || "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {m.products.some((p) => p.recommended === 0 && p.product.status === "active") && (
            <p className="mt-3 flex items-start gap-2 text-small text-navy-500"><Info size={16} className="mt-0.5 shrink-0" aria-hidden /> Products with zero recommendations weren't the most relevant option for any customer in the cohort — candidates for review.</p>
          )}
        </section>

        <section className="card p-5 md:p-6" aria-labelledby="needs-title">
          <h2 id="needs-title" className="mb-4 !text-[20px]">Emerging needs</h2>
          <ul className="flex flex-col gap-3">
            {m.needs.map((n) => (
              <li key={n.need}>
                <div className="mb-1 flex justify-between text-small"><span>{NEED_LABELS[n.need]}</span><span className="tabular-nums text-navy-500">{n.count}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-mist"><div className="h-full rounded-full bg-green" style={{ width: `${(n.count / maxNeed) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto p-5 md:p-6" aria-labelledby="seg-title">
          <h2 id="seg-title" className="mb-4 !text-[20px]">Customer segments</h2>
          <table className="w-full min-w-[400px] text-small">
            <thead><tr className="text-left text-navy-500"><th scope="col" className="pb-2 font-medium">Segment</th><th scope="col" className="pb-2 font-medium">Most relevant product</th><th scope="col" className="pb-2 text-right font-medium">Match rate</th></tr></thead>
            <tbody className="divide-y divide-mist">
              {m.segments.map((s) => (
                <tr key={s.archetype}>
                  <th scope="row" className="py-2.5 text-left font-medium">{s.archetype} <span className="font-normal text-navy-500">({s.customers})</span></th>
                  <td className="py-2.5">{s.topProduct}</td>
                  <td className="py-2.5 text-right tabular-nums">{Math.round(s.matchRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="card p-5 md:p-6" aria-labelledby="quality-title">
          <h2 id="quality-title" className="mb-4 !text-[20px]">Quality & guardrails</h2>
          <ul className="flex flex-col divide-y divide-mist text-small">
            {[
              ["Relevance feedback (useful)", pct(m.useful, m.recommended), true],
              ["“I don't understand”", pct(m.dontUnderstand, m.recommended), m.dontUnderstand / Math.max(1, m.recommended) < 0.05],
              ["Remind me later", pct(m.remindLater, m.recommended), true],
              ["Recommendations failing eligibility", String(m.failedEligibility), m.failedEligibility === 0],
              ["Category opt-outs", String(m.optOuts), true],
              ["Recommendation fatigue (paused)", String(m.paused), true],
              ["Complaints", String(m.complaints), m.complaints < 3],
            ].map(([label, value, ok]) => (
              <li key={String(label)} className="flex items-center justify-between gap-3 py-2.5">
                <span className="flex items-center gap-2">
                  {ok ? <CheckCircle2 size={16} className="text-green-700" aria-label="Within guardrail" /> : <AlertTriangle size={16} className="text-amber-700" aria-label="Needs attention" />}
                  {label}
                </span>
                <span className="font-semibold tabular-nums">{value}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="card p-5 md:p-6" aria-labelledby="live-title">
        <h2 id="live-title" className="mb-1 !text-[20px]">This session (live)</h2>
        <p className="mb-4 text-small text-navy-500">Real events from the customer app in this browser — the feedback store that feeds quality analysis.</p>
        {live.length === 0 ? (
          <p className="text-navy-500">No recommendations issued yet in this session.</p>
        ) : (
          <div className="flex flex-wrap gap-6">
            <div><p className="text-[28px] font-bold leading-9 tabular-nums">{live.length}</p><p className="text-small text-navy-500">Recommendations issued</p></div>
            <div><p className="text-[28px] font-bold leading-9 tabular-nums">{liveFeedback.length}</p><p className="text-small text-navy-500">With feedback</p></div>
            <div><p className="text-[28px] font-bold leading-9 tabular-nums">{state.applications.length}</p><p className="text-small text-navy-500">Product requests</p></div>
            <div className="flex flex-wrap items-center gap-2">
              {liveFeedback.map((r) => <Badge key={r.id}>{r.productName}: {FEEDBACK_LABELS[r.feedback!]}</Badge>)}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
