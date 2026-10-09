import { CheckCircle2, Info } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { Donut, Funnel, Sparkline } from "../../components/charts/Mini";
import { DECISION_WINDOW_DAYS, NEED_LABELS } from "../../engine";
import { ROUNDS, simulateCohort } from "../../services/analytics";
import { API_MODE, http } from "../../services/http";
import type { FinancialNeed } from "../../types";
import { FEEDBACK_LABELS } from "../../utils/labels";

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "—");
const rate = (n: number, d: number) => (d ? n / d : 0);

/** Short column names for the heatmap. */
const NEED_SHORT: Record<FinancialNeed, string> = {
  goal_saving: "Goal saving",
  surplus_management: "Money left over",
  basic_savings: "Savings habit",
  student_banking: "Student life",
  expense_financing: "Planned expense",
  asset_financing: "Asset purchase",
  flexible_payments: "Card payments",
  wealth_growth: "Growing money",
  business_banking: "Business",
  financial_protection: "Protection",
};

function Kpi({ label, value, note, trend, delta, hero = false }: { label: string; value: string; note: string; trend: number[]; delta?: string; hero?: boolean }) {
  return (
    <div className={`${hero ? "midnight border-0 text-white" : "card"} flex flex-col justify-between gap-4 rounded-[20px] p-5`}>
      <dt className={`flex items-center justify-between gap-2 text-small font-medium ${hero ? "text-white/70" : "text-ink-3"}`}>
        {label}
        {hero && <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[11px] font-semibold text-mint">North Star</span>}
      </dt>
      <dd className="flex items-end justify-between gap-3">
        <span>
          <span className="num block font-display text-[34px] font-semibold leading-none">{value}</span>
          <span className={`mt-2 block text-caption !font-normal ${hero ? "text-white/60" : "text-ink-3"}`}>
            {delta && <span className={`mr-1 font-semibold ${hero ? "text-mint" : "text-green-700"}`}>{delta}</span>}
            {note}
          </span>
        </span>
        <Sparkline values={trend} colour={hero ? "#2ee6a8" : "var(--blue)"} width={96} height={40} />
      </dd>
    </div>
  );
}

export function AdminOverviewPage() {
  const { state } = useStore();
  const m = useMemo(() => simulateCohort(state.products), [state.products]);
  const needsUsed = [...new Set(m.products.flatMap((p) => Object.keys(p.needs)))] as FinancialNeed[];
  const maxCell = Math.max(1, ...m.products.flatMap((p) => Object.values(p.needs) as number[]));
  const w = m.weekly;
  const usefulTrend = w.map((x) => rate(x.useful, x.generated) * 100);
  const first = usefulTrend[0];
  const lastU = usefulTrend[usefulTrend.length - 1];
  const change = Math.round(lastU - first);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-2">
        <p className="eyebrow">Bank view · last {ROUNDS} weeks</p>
        <h1>How MoneyMap is <span className="accent-serif">performing</span></h1>
        <p className="max-w-prose text-ink-3">
          The real engine, run over {m.customers} synthetic customers. Change the catalogue and every number here updates.
        </p>
      </header>

      <section aria-labelledby="kpi-title">
        <h2 id="kpi-title" className="sr-only">Key numbers</h2>
        <dl className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi hero label="Useful rate" value={pct(m.useful, m.generated)} note="said a suggestion was useful" delta={change ? `${change > 0 ? "+" : ""}${change} pts` : undefined} trend={usefulTrend} />
          <Kpi label="Recommendations" value={m.generated.toLocaleString()} note={`from ${m.decisions.toLocaleString()} decisions`} trend={w.map((x) => x.generated)} />
          <Kpi label="Accepted" value={pct(m.accepted, m.generated)} note="took the product" trend={w.map((x) => rate(x.accepted, x.generated))} />
          <Kpi label="Held back on purpose" value={pct(m.noMatch + m.windowCapped + m.paused, m.decisions)} note="no fit, weekly cap or a pause" trend={w.map((x) => x.noMatch + x.heldBack)} />
        </dl>
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="card p-5 md:p-6" aria-labelledby="funnel-title">
          <h2 id="funnel-title" className="!text-[18px]">From decision to customer</h2>
          <p className="mb-5 mt-1 text-small text-ink-3">Most decisions end with no suggestion. That's the engine being careful.</p>
          <Funnel
            stages={[
              { label: "Decisions", value: m.decisions, note: `${m.customers} customers × ${ROUNDS} weeks` },
              { label: "Recommended", value: m.generated, note: "a product fitted a need" },
              { label: "Useful", value: m.useful, note: "customer said so" },
              { label: "Accepted", value: m.accepted, note: "took the product" },
            ]}
          />
        </section>

        <section className="card p-5 md:p-6" aria-labelledby="rel-title">
          <h2 id="rel-title" className="!text-[18px]">What customers told us</h2>
          <p className="mb-5 mt-1 text-small text-ink-3">Feedback on every suggestion. Hover a row.</p>
          <Donut
            centre={pct(m.useful, m.generated)}
            centreLabel="useful"
            slices={[
              { label: "Useful", value: m.useful, colour: "var(--mint-600)" },
              { label: "Not relevant", value: m.notRelevant, colour: "var(--amber)" },
              { label: "Remind me later", value: m.remindLater, colour: "var(--blue)" },
              { label: "I don't want this", value: m.rejected, colour: "var(--red)" },
              { label: "I don't understand", value: m.notUnderstood, colour: "var(--ink-3)" },
              { label: "No answer", value: Math.max(0, m.generated - m.useful - m.notRelevant - m.remindLater - m.rejected - m.notUnderstood), colour: "var(--line)" },
            ]}
          />
        </section>
      </div>

      <section tabIndex={0} className="card overflow-x-auto p-5 md:p-6 focus:outline-none focus-visible:ring-3 focus-visible:ring-blue/40" aria-labelledby="match-title">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="match-title" className="!text-[18px]">Which products meet which needs</h2>
            <p className="mt-1 text-small text-ink-3">Darker means more recommendations.</p>
          </div>
          <div className="flex items-center gap-2 text-caption !font-normal text-ink-3" aria-hidden>
            Fewer
            {[10, 22, 34, 45].map((x) => <span key={x} className="h-3 w-5 rounded-[4px]" style={{ background: `color-mix(in oklab, var(--blue-600) ${x}%, var(--surface))` }} />)}
            More
          </div>
        </div>
        <table className="w-full min-w-[640px] border-separate border-spacing-1 text-small">
          <thead>
            <tr className="text-left text-ink-3">
              <th scope="col" className="pb-1 font-medium">Product</th>
              {needsUsed.map((n) => <th key={n} scope="col" className="px-1 pb-1 text-center font-medium">{NEED_SHORT[n]}</th>)}
              <th scope="col" className="pb-1 pl-3 text-right font-medium">Total</th>
              <th scope="col" className="pb-1 pl-3 text-right font-medium">Useful</th>
            </tr>
          </thead>
          <tbody>
            {m.products.map((p) => (
              <tr key={p.product.product_id}>
                <th scope="row" className="whitespace-nowrap py-1 pr-2 text-left font-medium">
                  {p.product.name}
                  {p.product.status !== "active" && <span className="ml-2"><Badge>Inactive</Badge></span>}
                </th>
                {needsUsed.map((n) => {
                  const v = p.needs[n] ?? 0;
                  return (
                    <td
                      key={n}
                      className="num h-10 min-w-[64px] rounded-[8px] text-center"
                      style={{ background: v ? `color-mix(in oklab, var(--blue-600) ${8 + (v / maxCell) * 37}%, var(--surface))` : "var(--surface-2)" }}
                    >
                      {v ? v : <span className="text-ink-3">·</span>}
                    </td>
                  );
                })}
                <td className="num py-1 pl-3 text-right font-semibold">{p.recommended}</td>
                <td className="num py-1 pl-3 text-right">{pct(p.useful, p.recommended)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {m.products.some((p) => p.recommended === 0 && p.product.status === "active") && (
          <p className="mt-4 flex items-start gap-2 text-small text-ink-3">
            <Info size={16} className="mt-0.5 shrink-0" aria-hidden /> A product nobody was matched to wasn't the best fit for this cohort. That's a signal to review, not to push it harder.
          </p>
        )}
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <section className="card p-5 md:p-6" aria-labelledby="seg-title">
          <h2 id="seg-title" className="!text-[18px]">By customer group</h2>
          <p className="mb-5 mt-1 text-small text-ink-3">Share of each group that got at least one suggestion.</p>
          <ul className="flex flex-col gap-4">
            {m.segments.map((s, i) => (
              <li key={s.archetype}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-medium">{s.archetype}</span>
                  <span className="num shrink-0 font-semibold">{Math.round(s.matchRate * 100)}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full origin-left rounded-full bg-gradient-to-r from-blue to-mint" style={{ width: `${s.matchRate * 100}%`, animation: `mm-grow-x 800ms ${i * 120}ms both cubic-bezier(.22,1,.36,1)` }} />
                </div>
                <p className="mt-1 text-caption !font-normal text-ink-3">{s.customers} customers · most often {s.topProduct}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="card p-5 md:p-6" aria-labelledby="fatigue-title">
          <h2 id="fatigue-title" className="!text-[18px]">No nagging</h2>
          <p className="mb-5 mt-1 text-small text-ink-3">Limits that stop customers being over-sold.</p>
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["Suggestions per customer", m.exposuresPerCustomer.toFixed(1), `over ${ROUNDS} weeks · max ${m.maxExposures}`],
              ["Held by weekly cap", pct(m.windowCapped, m.decisions), `1 new suggestion per ${DECISION_WINDOW_DAYS} days`],
              ["Paused for fatigue", pct(m.paused, m.decisions), "after repeated dismissals"],
              ["Repeated after a no", String(m.repeatAfterDismissal), "target: 0"],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-[14px] bg-surface-2 p-3.5">
                <dt className="text-caption !font-normal text-ink-3">{label}</dt>
                <dd className="num mt-1 font-display text-[22px] font-semibold leading-tight">{value}</dd>
                <dd className="text-caption !font-normal text-ink-3">{note}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>

      <section className="card p-5 md:p-6" aria-labelledby="gov-title">
        <h2 id="gov-title" className="mb-4 !text-[18px]">Governance checks</h2>
        <ul className="grid grid-cols-1 gap-x-6 gap-y-2.5 text-small md:grid-cols-2">
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

      <LiveSection />
      <VisitsSection />
    </div>
  );
}

/** Anonymous visits to the public pages — a daily count only, no cookies or identifiers. */
export function VisitsSection() {
  const [data, setData] = useState<{ total: number; by_page: { path: string; visits: number }[] } | null>(null);
  useEffect(() => {
    if (API_MODE) http.adminAnalytics().then(setData).catch(() => setData(null));
  }, []);
  if (!API_MODE) return null;
  const NAMES: Record<string, string> = { "/": "Home page", "/privacy": "Privacy policy", "/terms": "Terms of use" };
  return (
    <section className="card p-5 md:p-6" aria-labelledby="visits-title">
      <h2 id="visits-title" className="mb-1 !text-[18px]">Public page visits · last 30 days</h2>
      <p className="mb-4 text-small text-ink-3">Counted without cookies, IP addresses or identifiers, and never on customers' financial screens. Browsers that send Do Not Track aren't counted.</p>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-[14px] bg-surface-2 p-3">
          <dt className="text-small text-ink-3">All public pages</dt>
          <dd className="num font-display text-[22px] font-semibold">{data?.total ?? "—"}</dd>
        </div>
        {(data?.by_page ?? []).map((p) => (
          <div key={p.path} className="rounded-[14px] bg-surface-2 p-3">
            <dt className="text-small text-ink-3">{NAMES[p.path]}</dt>
            <dd className="num font-display text-[22px] font-semibold">{p.visits}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function LiveSection() {
  const { state } = useStore();
  const [server, setServer] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (API_MODE) http.adminMetrics().then((m) => setServer(m.live as Record<string, number>)).catch(() => setServer(null));
  }, []);
  const live = state.recommendations;
  return (
    <section className="card p-5 md:p-6" aria-labelledby="live-title">
      <h2 id="live-title" className="mb-1 !text-[18px]">{API_MODE ? "Live from the MoneyMap server" : "This session (live)"}</h2>
      <p className="mb-4 text-small text-ink-3">
        {API_MODE
          ? "Every recommendation stored on the server, across all customers — the feedback store that feeds quality analysis."
          : "Real events from the customer app in this browser — the feedback store that feeds quality analysis."}
      </p>
      {API_MODE && server && (
        <dl className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["generated", "accepted", "useful", "dismissed", "rejected"] as const).map((k) => (
            <div key={k} className="rounded-[14px] bg-surface-2 p-3">
              <dt className="text-small capitalize text-ink-3">{k}</dt>
              <dd className="num font-display text-[22px] font-semibold">{server[k] ?? 0}</dd>
            </div>
          ))}
        </dl>
      )}
      {live.length === 0 ? (
        <p className="text-ink-3">No recommendations issued yet for the current customer.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line text-small">
          {live.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span><span className="font-medium">{r.product_name}</span> → {r.customer_id} · {r.match_score}% · need: {r.need ? NEED_LABELS[r.need] : "—"}</span>
              <Badge tone={r.feedback === "useful" ? "green" : r.feedback ? "neutral" : "blue"}>{r.feedback ? FEEDBACK_LABELS[r.feedback] : r.status}</Badge>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
