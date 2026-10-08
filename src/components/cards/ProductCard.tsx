import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import type { Evaluation } from "../../engine";
import type { Product } from "../../types";
import { CATEGORY_META } from "../../utils/labels";
import { Badge } from "../shared/Badge";

export function ProductCard({ product, evaluation }: { product: Product; evaluation?: Evaluation }) {
  const meta = CATEGORY_META[product.category];
  const Icon = meta.icon;
  return (
    <Link
      to={`/app/products/${product.product_id}`}
      className="card group flex h-full flex-col p-5 transition-shadow hover:shadow-md"
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-[12px] bg-blue-50 text-blue"><Icon size={24} aria-hidden /></span>
        {evaluation && <FitBadge evaluation={evaluation} />}
      </div>
      <h3 className="mb-1 !text-[18px]">{product.name}</h3>
      <p className="mb-4 flex-1 text-small text-navy-500">{product.purpose}</p>
      <span className="inline-flex items-center gap-1 text-small font-semibold text-blue-600">
        View details <ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  );
}

export function FitBadge({ evaluation }: { evaluation: Evaluation }) {
  if (evaluation.exclusion) {
    const map = {
      already_held: "You have this",
      inactive: "Unavailable",
      opted_out: "Hidden by you",
      customer_declined: "Declined",
      ineligible: "Not eligible",
      unsuitable: "Doesn't fit",
      conflict: "Not right now",
      snoozed: "Snoozed",
      category_fatigue: "Paused",
    } as const;
    return <Badge tone={evaluation.exclusion.rule === "already_held" ? "blue" : "neutral"}>{map[evaluation.exclusion.rule]}</Badge>;
  }
  if (evaluation.band === "strong") return <Badge tone="green">{evaluation.score}% · Strong match</Badge>;
  if (evaluation.band === "potential") return <Badge tone="amber">{evaluation.score}% · Potential</Badge>;
  return <Badge>Low relevance</Badge>;
}
