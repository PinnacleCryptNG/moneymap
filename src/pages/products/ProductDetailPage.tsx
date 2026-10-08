import { ArrowLeft, CircleAlert, CircleCheck, CircleHelp, ExternalLink, FileText, Info, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { FitBadge } from "../../components/cards/ProductCard";
import { Badge } from "../../components/shared/Badge";
import { Button } from "../../components/shared/Button";
import { Modal } from "../../components/shared/Modal";
import { EmptyState } from "../../components/shared/States";
import { useToast } from "../../components/shared/Toast";
import { SUBJECT_TO_ZENITH } from "../../data/products";
import type { Evaluation } from "../../engine";
import { postApply, postEligibilityCheck } from "../../services/api";
import { API_MODE, http } from "../../services/http";
import { useEngineInput, useEngineResult } from "../../services/recommendation";
import { formatDate } from "../../utils/format";
import { CATEGORY_META } from "../../utils/labels";

const ROUTE_LABEL = { digital: "Open on the Zenith app", branch: "Completed at a Zenith branch", relationship_manager: "Through a relationship manager" };

export function ProductDetailPage() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const input = useEngineInput(true);
  const result = useEngineResult(true);
  const evaluation = result.ranked.find((e) => e.product.product_id === id);
  const [check, setCheck] = useState<Pick<Evaluation, "eligibility"> | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);

  // API mode: record the product view (a PRD "product interaction").
  useEffect(() => {
    if (API_MODE && id && http.hasSession()) http.viewProduct(id).catch(() => undefined);
  }, [id]);

  if (!evaluation) {
    return <EmptyState icon={Info} title="Product not found" body="This product isn't in the catalogue." actions={<Link className="font-semibold text-blue-600" to="/app/products">Back to products</Link>} />;
  }
  const p = evaluation.product;
  const Icon = CATEGORY_META[p.category].icon;
  const application = state.applications.find((a) => a.productId === p.product_id);
  const isTop = result.top?.product.product_id === p.product_id;
  const blocked = evaluation.exclusion && evaluation.exclusion.rule !== "opted_out" && evaluation.exclusion.rule !== "customer_declined" && evaluation.exclusion.rule !== "snoozed" && evaluation.exclusion.rule !== "category_fatigue";

  const runCheck = async () => {
    setChecking(true);
    try {
      setCheck(await postEligibilityCheck(input, p.product_id));
    } finally {
      setChecking(false);
    }
  };

  const apply = async () => {
    setApplying(true);
    try {
      await postApply(p);
      dispatch({ type: "apply", productId: p.product_id, productName: p.name });
      toast(p.category === "financing" ? "Request sent for Zenith's credit assessment." : "Request sent. Zenith will guide you through the next steps.");
      setConfirmOpen(false);
    } finally {
      setApplying(false);
    }
  };

  const shown = check ?? null;

  return (
    <div className="flex flex-col gap-6">
      <Link to="/app/products" className="inline-flex min-h-11 w-fit items-center gap-1 font-medium text-blue-600 hover:underline">
        <ArrowLeft size={18} aria-hidden /> All products
      </Link>

      <section className="rounded-[24px] border border-mist bg-white p-6 md:p-8">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <Badge>{CATEGORY_META[p.category].label}</Badge>
          <FitBadge evaluation={evaluation} />
          {isTop && <Badge tone="navy">Recommended for you</Badge>}
        </div>
        <div className="mb-3 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-blue-50 text-blue"><Icon size={24} aria-hidden /></span>
          <div><h1 className="!text-[28px] !leading-9">{p.name}</h1><p className="text-small text-navy-500">Zenith Bank</p></div>
        </div>
        <p className="text-body-lg mb-2 text-navy-700">{p.description}</p>
        <p className="text-small text-navy-500">Purpose: {p.purpose} · {ROUTE_LABEL[p.application_route]}</p>

        {evaluation.exclusion && (
          <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-cloud p-3 text-small text-navy-700">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden /> {evaluation.exclusion.reason}
          </p>
        )}
        {!evaluation.exclusion && !isTop && evaluation.whyNot && (
          <p className="mt-4 flex items-start gap-2 rounded-[12px] bg-cloud p-3 text-small text-navy-700">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden /> MoneyMap didn't put this first: {evaluation.whyNot}
          </p>
        )}

        <div className="mt-6 flex flex-wrap gap-3">
          {application ? (
            <Badge tone="green" icon={<CircleCheck size={14} aria-hidden />}>
              Request submitted {formatDate(application.at)}
              {application.reference ? ` · Zenith ref ${application.reference}` : application.handoff === "pending" ? " · sending to Zenith" : ""}
            </Badge>
          ) : (
            <Button disabled={Boolean(blocked) || p.status !== "active"} onClick={() => setConfirmOpen(true)}>
              {p.category === "financing" ? "Start a request" : "Request to open"}
            </Button>
          )}
          <Button variant="secondary" onClick={runCheck} disabled={checking} icon={checking ? <Loader2 size={18} className="animate-spin" aria-hidden /> : undefined}>
            {checking ? "Checking…" : "Confirm eligibility"}
          </Button>
        </div>
      </section>

      {shown && (
        <section className="card fade-up p-6" aria-live="polite" aria-labelledby="elig-title">
          <h2 id="elig-title" className="mb-1 !text-[20px]">
            {shown.eligibility.status === "eligible" ? "You appear to meet the requirements" : shown.eligibility.status === "to_confirm" ? "Some requirements need confirming" : "You don't currently meet the requirements"}
          </h2>
          <p className="mb-4 text-small text-navy-500">Indicative check using published conditions and the information you've allowed. {shown.eligibility.note}{p.category === "financing" ? " Credit is decided by Zenith's assessment." : ""}</p>
          <ul className="flex flex-col gap-2">
            {shown.eligibility.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                {c.status === "pass" ? <CircleCheck size={20} className="shrink-0 text-green-700" aria-label="Met" /> : c.status === "fail" ? <CircleAlert size={20} className="shrink-0 text-red" aria-label="Not met" /> : <CircleHelp size={20} className="shrink-0 text-amber-700" aria-label="To confirm" />}
                <span><span className="font-medium">{c.label}</span> — <span className="text-navy-700">{c.detail}</span> <span className="text-small text-navy-500">({c.basis === "published" ? "published condition" : "MoneyMap check"})</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <section className="card p-6" aria-labelledby="facts-title">
          <h2 id="facts-title" className="mb-1 !text-[20px]">Published information</h2>
          <p className="mb-3 text-small text-navy-500">From public sources found during the build. Confirm current details with Zenith.</p>
          {p.published.length === 0 ? (
            <p className="text-navy-700">No product details were found in public sources. Details must come from Zenith's approved product catalogue.</p>
          ) : (
            <ul className="flex flex-col gap-2.5">
              {p.published.map((f) => (
                <li key={f.text} className="flex items-start gap-2 text-navy-700">
                  <FileText size={18} className="mt-0.5 shrink-0 text-navy-500" aria-hidden />
                  <span className="min-w-0">
                    {f.text}{" "}
                    <a href={f.source} target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-small text-blue-600 hover:underline">
                      source <ExternalLink size={12} aria-hidden />
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="card p-6" aria-labelledby="unknown-title">
          <h2 id="unknown-title" className="mb-3 !text-[20px]">Rates, fees and limits</h2>
          <p className="text-navy-700">{SUBJECT_TO_ZENITH}</p>
          <p className="mt-3 text-small text-navy-500">MoneyMap never shows invented interest rates, fees, limits, approval guarantees or processing times.</p>
        </section>
      </div>

      <p className="text-caption !font-normal text-navy-500">Catalogue entry v{p.version}. MoneyMap suggests; you decide. No financial outcome is guaranteed.</p>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={`Continue with ${p.name}?`}>
        <p className="mb-3 text-navy-700">
          {p.category === "financing"
            ? "This submits your request for the bank's formal credit assessment. MoneyMap does not approve credit, and submitting doesn't commit you to borrowing."
            : p.application_route === "branch"
              ? "Zenith will contact you to continue at a branch. You'll see the full terms before anything is set up."
              : "This starts the opening journey on the Zenith app. You'll see the full terms before anything is set up."}
        </p>
        <p className="mb-6 text-small text-navy-500">Prototype: no real account is opened and no money moves.</p>
        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button onClick={apply} disabled={applying}>{applying ? "Submitting…" : "Confirm"}</Button>
        </div>
      </Modal>
    </div>
  );
}
