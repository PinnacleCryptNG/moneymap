import { CheckCircle2, Info } from "lucide-react";
import { useMemo } from "react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { DECISION_WINDOW_DAYS, NEED_LABELS } from "../../engine";
import { ROUNDS, simulateCohort } from "../../services/analytics";
import type { FinancialNeed } from "../../types";
import { FEEDBACK_LABELS } from "../../utils/labels";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");

function Stat({ label, value, note, tone }: { label: string; value: string; note: string; tone?: "green" | "amber" }) {
  return (
    <div className="card p-4 md:p-5">
      <dt className="text-small text-navy-500">{label}</dt>
      <dd className={`text-[28px] font-bold leading-9 tabular-nums ${tone === "green" ? "text-green-700" : tone === "amber" ? "text-amber-700" : ""}`}>{value}</dd>
      <dd className="text-caption !font-normal text-navy-500">{note}</dd>
    </div>
  );
}

export function AdminOverviewPage() {
  const { state } = useStore();
  const m = useMemo(() => simulateCohort(state.products), [state.products]);
  const live = state.recommendations;
  const needsUsed = [...new Set(m.products.flatMap((p) => Object.keys(p.needs)))] as FinancialNeed[];

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Bank view"
        title="How MoneyMap is performing"
        body={`The real decision engine run over ${m.customers} synthetic Nigerian customers for ${ROUNDS} weekly decision rounds each, with simulated customer responses fed back in. Change the catalogue and these numbers update.`}
      />

      <section aria-labelledby="perf-title">
        <h2 id="perf-title" className="mb-3 !text-[20px]">Recommendation performance</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Stat label="Generated" value={m.generated.toLocaleString()} note={`from ${m.decisions.toLocaleString()} decisions`} />
          <Stat label="Accepted" value={pct(m.accepted, m.generated)} note="customer took the product" tone="green" />
          <Stat label="Rejected" value={pct(m.rejected, m.generated)} note="“I don't want this”" />
          <Stat label="Dismissed" value={pct(m.dismissed, m.generated)} note="not relevant / remind me later" />
          <Stat label="No-match outcomes" value={pct(m.noMatch, m.decisions)} note="engine chose not to recommend" />
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.5fr_1fr]">
        <section className="card overflow-x-auto p-5 md:p-6" aria-labelledby="match-title">
          <h2 id="match-title" className="mb-1 !text-[20px]">Which products meet which needs</h2>
          <p className="mb-4 text-small text-navy-500">Recommendations by product and the need that triggered them.</p>
          <table className="w-full min-w-[560px] text-small">
            <thead>
              <tr className="text-left text-navy-500">
                <th scope="col" className="pb-2 font-medium">Product</th>
                {needsUsed.map((n) => <th key={n} scope="col" className="pb-2 pl-3 font-medium">{NEED_LABELS[n]}</th>)}
                <th scope="col" className="pb-2 pl-3 text-right font-medium">Total</th>
                <th scope="col" className="pb-2 pl-3 text-right font-medium">Useful</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-mist">
              {m.products.map((p) => (
                <tr key={p.product.product_id}>
                  <th scope="row" className="py-2.5 pr-2 text-left font-medium">
                    {p.product.name}
                    {p.product.status !== "active" && <span className="ml-2"><Badge>Inactive</Badge></span>}
                  </th>
                  {needsUsed.map((n) => (
                    <td key={n} className="py-2.5 pl-3 tabular-nums">{p.needs[n] ? p.needs[n] : <span className="text-navy-500">·</span>}</td>
                  ))}
                  <td className="py-2.5 pl-3 text-right font-semibold tabular-nums">{p.recommended}</td>
                  <td className="py-2.5 pl-3 text-right tabular-nums">{pct(p.useful, p.recommended)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {m.products.some((p) => p.recommended === 0 && p.product.status === "active") && (
            <p className="mt-3 flex items-start gap-2 text-small text-navy-500">
              <Info size={16} className="mt-0.5 shrink-0" aria-hidden /> A product with no recommendations wasn't the best fit for anyone in this cohort. That's a signal to review, not to push it harder.
            </p>
          )}
        </section>

        <section className="card p-5 md:p-6" aria-labelledby="rel-title">
          <h2 id="rel-title" className="mb-1 !text-[20px]">Customer relevance</h2>
          <p className="mb-4 text-small text-navy-500">What customers told MoneyMap about its recommendations.</p>
          <ul className="flex flex-col gap-3">
            {[
              ["Useful", m.useful, "bg-green"],
              ["Not relevant", m.notRelevant, "bg-amber"],
              ["I don't want this", m.rejected, "bg-red"],
              ["Remind me later", m.remindLater, "bg-blue"],
              ["I don't understand", m.notUnderstood, "bg-navy-500"],
            ].map(([label, n, color]) => (
              <li key={label as string}>
                <div className="mb-1 flex justify-between text-small"><span>{label}</span><span className="tabular-nums text-navy-500">{pct(n as number, m.generated)}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-mist"><div className={`h-full rounded-full ${color}`} style={{ width: pct(n as number, m.generated) }} /></div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-small text-navy-500">Useful recommendation rate is MoneyMap's North Star metric.</p>
        </section>
      </div>

      <section aria-labelledby="fatigue-title">
        <h2 id="fatigue-title" className="mb-3 !text-[20px]">Recommendation fatigue</h2>
        <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Exposures per customer" value={m.exposuresPerCustomer.toFixed(1)} note={`over ${ROUNDS} weeks (max seen: ${m.maxExposures})`} />
          <Stat label="Held back by weekly cap" value={pct(m.windowCapped, m.decisions)} note={`max 1 new suggestion every ${DECISION_WINDOW_DAYS} days`} />
          <Stat label="Paused for fatigue" value={pct(m.paused, m.decisions)} note="after repeated dismissals" />
          <Stat label="Repeated after dismissal" value={String(m.repeatAfterDismissal)} note="target: 0" tone={m.repeatAfterDismissal === 0 ? "green" : "amber"} />
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <section className="card overflow-x-auto p-5 md:p-6" aria-labelledby="seg-title">
          <h2 id="seg-title" className="mb-1 !text-[20px]">By customer group</h2>
          <p className="mb-4 text-small text-navy-500">Each synthetic customer gets varied goals, so even well-served customers sometimes have a genuine new need.</p>
          <table className="w-full min-w-[380px] text-small">
            <thead><tr className="text-left text-navy-500"><th scope="col" className="pb-2 font-medium">Customer group</th><th scope="col" className="pb-2 font-medium">Most matched product</th><th scope="col" className="pb-2 text-right font-medium">Got a match</th></tr></thead>
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

        <section className="card p-5 md:p-6" aria-labelledby="gov-title">
          <h2 id="gov-title" className="mb-4 !text-[20px]">Governance checks</h2>
          <ul className="flex flex-col gap-2.5 text-small">
            {[
              `${pct(m.generated - m.unexplained, m.generated)} of recommendations carry a full explanation`,
              "Every recommendation stores customer, product, need, score, reasons, timing and eligibility",
              "Relevance score is separate from commercial value",
              "No invented rates, fees or limits — unpublished terms say “Subject to Zenith Bank's current requirements”",
              "Customer data is used only within granted permissions",
            ].map((t) => (
              <li key={t} className="flex items-start gap-2"><CheckCircle2 size={16} className="mt-0.5 shrink-0 text-green-700" aria-hidden />{t}</li>
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
          <ul className="flex flex-col divide-y divide-mist text-small">
            {live.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                <span><span className="font-medium">{r.product_name}</span> → {r.customer_id} · {r.match_score}% · need: {r.need ? NEED_LABELS[r.need] : "—"}</span>
                <Badge tone={r.feedback === "useful" ? "green" : r.feedback ? "neutral" : "blue"}>{r.feedback ? FEEDBACK_LABELS[r.feedback] : r.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
