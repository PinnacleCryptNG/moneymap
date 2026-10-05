import { ArrowLeft, CircleAlert, CircleCheck, CircleHelp, FileText, Info, Loader2 } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { FitBadge } from "../../components/cards/ProductCard";
import { Badge } from "../../components/shared/Badge";
import { Button } from "../../components/shared/Button";
import { Modal } from "../../components/shared/Modal";
import { EmptyState } from "../../components/shared/States";
import { useToast } from "../../components/shared/Toast";
import type { Evaluation } from "../../engine";
import { postApply, postEligibilityCheck } from "../../services/api";
import { useEngineInput, useEngineResult } from "../../services/recommendation";
import { formatDate } from "../../utils/format";
import { CATEGORY_META } from "../../utils/labels";

const ROUTE_LABEL = { digital: "Apply digitally", branch: "Visit a branch", relationship_manager: "Through a relationship manager" };

export function ProductDetailPage() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const toast = useToast();
  const input = useEngineInput(true);
  const result = useEngineResult(true);
  const evaluation = result.ranked.find((e) => e.product.product_id === id);
  const [check, setCheck] = useState<Evaluation | null>(null);
  const [checking, setChecking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [applying, setApplying] = useState(false);

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
      toast(p.category === "financing" ? "Application submitted for credit assessment." : "Request submitted. We'll guide you through the next steps.");
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
          <h1 className="!text-[28px] !leading-9">{p.name}</h1>
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
            <Badge tone="green" icon={<CircleCheck size={14} aria-hidden />}>Request submitted {formatDate(application.at)}</Badge>
          ) : (
            <Button disabled={Boolean(blocked) || p.status !== "active"} onClick={() => setConfirmOpen(true)}>
              {p.application_route === "relationship_manager" ? "Request a call" : p.category === "financing" ? "Start application" : "Open / activate"}
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
            {shown.eligibility.status === "eligible" ? "You appear to meet the requirements" : shown.eligibility.status === "needs_confirmation" ? "Some requirements need confirming" : "You don't currently meet the requirements"}
          </h2>
          <p className="mb-4 text-small text-navy-500">Indicative check on the information you've permitted. Final eligibility follows the bank's formal checks{p.category === "financing" ? " and credit assessment" : ""}.</p>
          <ul className="flex flex-col gap-2">
            {shown.eligibility.checks.map((c) => (
              <li key={c.label} className="flex items-start gap-2">
                {c.status === "pass" ? <CircleCheck size={20} className="shrink-0 text-green-700" aria-label="Met" /> : c.status === "fail" ? <CircleAlert size={20} className="shrink-0 text-red" aria-label="Not met" /> : <CircleHelp size={20} className="shrink-0 text-amber-700" aria-label="To confirm" />}
                <span><span className="font-medium">{c.label}</span> — <span className="text-navy-700">{c.detail}</span></span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <section className="card p-6" aria-labelledby="terms-title">
          <h2 id="terms-title" className="mb-3 !text-[20px]">Key terms</h2>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-navy-700">{p.key_terms.map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="mt-4 text-small"><span className="font-medium">Fees: </span><span className="text-navy-700">{p.fees}</span></p>
        </section>
        <section className="card p-6" aria-labelledby="docs-title">
          <h2 id="docs-title" className="mb-3 !text-[20px]">What you'll need</h2>
          <ul className="flex flex-col gap-2">
            {p.required_documents.map((d) => (
              <li key={d} className="flex items-center gap-2 text-navy-700"><FileText size={18} className="text-navy-500" aria-hidden />{d}</li>
            ))}
            <li className="flex items-center gap-2 text-navy-700"><FileText size={18} className="text-navy-500" aria-hidden />Minimum age {p.eligibility.minimum_age}</li>
          </ul>
        </section>
      </div>

      <p className="text-caption !font-normal text-navy-500">Prototype product (v{p.version}). Terms are illustrative and must be replaced with Zenith-approved product information. No guaranteed outcomes are implied.</p>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} title={`Continue with ${p.name}?`}>
        <p className="mb-3 text-navy-700">
          {p.category === "financing"
            ? "This submits your request for the bank's formal credit assessment. MoneyMap does not approve credit, and submitting doesn't commit you to borrowing."
            : p.application_route === "relationship_manager"
              ? "A relationship manager will contact you to complete a risk-profile assessment before anything is set up."
              : "This starts the product's opening journey. You'll review full terms before anything is activated."}
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
