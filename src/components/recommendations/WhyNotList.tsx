import { Link } from "react-router-dom";
import type { Evaluation } from "../../engine";
import { FitBadge } from "../cards/ProductCard";

export function WhyNotList({ items, limit }: { items: Evaluation[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  return (
    <ul className="flex flex-col divide-y divide-mist">
      {shown.map((e) => (
        <li key={e.product.product_id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <Link to={`/app/products/${e.product.product_id}`} className="font-semibold hover:text-blue-600 hover:underline">{e.product.name}</Link>
            <p className="text-small text-navy-500"><span className="font-medium text-navy-700">Not recommended because: </span>{e.whyNot}</p>
          </div>
          <div className="shrink-0"><FitBadge evaluation={e} /></div>
        </li>
      ))}
    </ul>
  );
}

/** Alternatives worth listing: skip those with no relationship to the customer's needs. */
export function consideredAlternatives(ranked: Evaluation[], topId?: string) {
  return ranked.filter(
    (e) =>
      e.product.product_id !== topId &&
      e.product.status === "active" &&
      (e.factors.needFit > 0 || e.exclusion?.rule === "ineligible" || e.exclusion?.rule === "already_held" || e.exclusion?.rule === "conflict"),
  );
}
