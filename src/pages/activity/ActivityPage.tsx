import { History, ShieldCheck } from "lucide-react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { PageHeader } from "../../components/shared/PageHeader";
import { EmptyState } from "../../components/shared/States";
import { NEED_LABELS } from "../../engine";
import { PERMISSION_COPY } from "../../services/consent";
import type { RecommendationStatus } from "../../types";
import { formatDateTime } from "../../utils/format";
import { FEEDBACK_LABELS } from "../../utils/labels";

const STATUS: Record<RecommendationStatus, { label: string; tone: "neutral" | "blue" | "green" | "amber" | "red" }> = {
  recommended: { label: "Shown", tone: "blue" },
  explored: { label: "Explored", tone: "blue" },
  applied: { label: "Applied", tone: "green" },
  dismissed: { label: "Dismissed", tone: "neutral" },
  snoozed: { label: "Remind later", tone: "amber" },
};

export function ActivityPage() {
  const { state } = useStore();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader eyebrow="Activity" title="Your MoneyMap activity" body="Every recommendation you've seen, what you told us, and every permission change — recorded transparently." />

      <section className="card p-5 md:p-6" aria-labelledby="recs-title">
        <h2 id="recs-title" className="mb-4 !text-[20px]">Recommendations</h2>
        {state.recommendations.length === 0 ? (
          <EmptyState icon={History} title="No recommendations yet" body="When MoneyMap finds something genuinely relevant, it'll appear here." actions={<ButtonLink to="/app/recommendation">Check now</ButtonLink>} />
        ) : (
          <ul className="flex flex-col divide-y divide-mist">
            {state.recommendations.map((r) => (
              <li key={r.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{r.product_name}</p>
                  <p className="text-small text-navy-500">{formatDateTime(r.created_at)} · {r.match_score}% match{r.need ? ` · ${NEED_LABELS[r.need]}` : ""}</p>
                  <p className="text-caption !font-normal text-navy-500">Based on: {r.reasons.join(", ")} · Eligibility: {r.eligibility_status.replace("_", " ")}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge tone={STATUS[r.status].tone}>{STATUS[r.status].label}</Badge>
                  {r.feedback && <Badge>{FEEDBACK_LABELS[r.feedback]}</Badge>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {state.applications.length > 0 && (
        <section className="card p-5 md:p-6" aria-labelledby="apps-title">
          <h2 id="apps-title" className="mb-4 !text-[20px]">Product requests</h2>
          <ul className="flex flex-col divide-y divide-mist">
            {state.applications.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-semibold">{a.productName}</p>
                  <p className="text-small text-navy-500">
                    {formatDateTime(a.at)}
                    {a.reference && <> · Zenith reference <span className="font-mono">{a.reference}</span></>}
                  </p>
                </div>
                {a.handoff === "pending" ? <Badge tone="amber">Sending to Zenith</Badge> : <Badge tone="green">With Zenith</Badge>}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card p-5 md:p-6" aria-labelledby="consent-title">
        <h2 id="consent-title" className="mb-4 flex items-center gap-2 !text-[20px]"><ShieldCheck size={22} className="text-green-700" aria-hidden /> Consent record</h2>
        <ul className="flex flex-col divide-y divide-mist text-small">
          {state.consentLog.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 py-2.5">
              <span>{c.permission === "all" ? "All permissions" : PERMISSION_COPY[c.permission].title}</span>
              <span className="flex items-center gap-3">
                <Badge tone={c.granted ? "green" : "neutral"}>{c.granted ? "Allowed" : "Not allowed"}</Badge>
                <span className="w-32 text-right text-navy-500">{formatDateTime(c.at)}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
