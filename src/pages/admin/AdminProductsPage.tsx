import { ExternalLink } from "lucide-react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { PageHeader } from "../../components/shared/PageHeader";
import { useToast } from "../../components/shared/Toast";
import { SUBJECT_TO_ZENITH } from "../../data/products";
import { NEED_LABELS } from "../../engine";
import { formatNaira } from "../../utils/format";
import { CATEGORY_META } from "../../utils/labels";

const human = (s: string) => s.replace(/_/g, " ");

export function AdminProductsPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Zenith products in MoneyMap"
        body="The six products the engine matches against. Published information is separated from MoneyMap's own matching rules. Status changes take effect immediately and are versioned and audited."
      />
      <p className="mb-6 rounded-[12px] border border-amber/40 bg-amber-50 p-3 text-small text-amber-700">
        Published facts come from press and comparison sites found during the build, not Zenith's own pages. Confirm each against Zenith's approved product information before a pilot. {SUBJECT_TO_ZENITH}
      </p>
      <ul className="flex flex-col gap-4">
        {state.products.map((p) => {
          const Icon = CATEGORY_META[p.category].icon;
          const e = p.eligibility;
          const published = [
            e.segments && `For ${e.segments.join(" / ")} customers`,
            (e.minimum_age !== undefined || e.maximum_age !== undefined) && `Age ${e.minimum_age ?? 0}${e.maximum_age ? `–${e.maximum_age}` : "+"}`,
            e.salary_account_required && "Salary paid into a Zenith account",
          ].filter(Boolean) as string[];
          const guardrails = [
            p.suitability.max_principal_to_income && `Principal repayment ≤ ${Math.round(p.suitability.max_principal_to_income * 100)}% of income`,
            p.suitability.max_balance && `Goal must fit reported ${formatNaira(p.suitability.max_balance)} balance cap`,
          ].filter(Boolean) as string[];
          return (
            <li key={p.product_id} className="card p-5">
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-blue-50 text-blue"><Icon size={20} aria-hidden /></span>
                  <div>
                    <p className="font-semibold">{p.name} <span className="font-mono text-[12px] font-normal text-ink-3">{p.product_id} · v{p.version}</span></p>
                    <p className="text-small text-ink-3">{CATEGORY_META[p.category].label} · {p.purpose}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={p.status === "active"}
                  aria-label={`${p.name} active`}
                  onClick={() => {
                    const next = p.status === "active" ? "inactive" : "active";
                    dispatch({ type: "set_product_status", productId: p.product_id, status: next });
                    toast(`${p.name} ${next === "active" ? "activated" : "deactivated"} — the engine has updated.`, "info");
                  }}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-3 text-small hover:bg-canvas"
                >
                  {p.status === "active" ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                  <span className="text-ink-3">{p.status === "active" ? "Deactivate" : "Activate"}</span>
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 text-small md:grid-cols-3">
                <div className="min-w-0">
                  <p className="mb-1 font-semibold">Published information</p>
                  {p.published.length === 0 ? (
                    <p className="text-ink-3">None found in public sources. Needs Zenith's approved details.</p>
                  ) : (
                    <ul className="flex flex-col gap-1 text-ink-2">
                      {p.published.map((f) => (
                        <li key={f.text}>
                          {f.text}{" "}
                          <a href={f.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-blue-600 hover:underline">source<ExternalLink size={11} aria-hidden /></a>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="mb-1 font-semibold">Eligibility the engine checks</p>
                  <p className="text-ink-2"><span className="text-ink-3">Published: </span>{published.length ? published.join("; ") : "none"}</p>
                  <p className="mt-1 text-ink-2"><span className="text-ink-3">MoneyMap guardrails: </span>{guardrails.length ? guardrails.join("; ") : "none"}</p>
                </div>
                <div className="min-w-0">
                  <p className="mb-1 font-semibold">Matching rules</p>
                  <p className="text-ink-2"><span className="text-ink-3">Needs: </span>{p.financial_needs.map((n) => NEED_LABELS[n]).join(", ")}</p>
                  <p className="mt-1 text-ink-2"><span className="text-ink-3">Recommended when: </span>{p.recommended_when.map(human).join(", ")}</p>
                  {p.not_recommended_when.length > 0 && <p className="mt-1 text-ink-2"><span className="text-ink-3">Not when: </span>{p.not_recommended_when.map(human).join(", ")}</p>}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
