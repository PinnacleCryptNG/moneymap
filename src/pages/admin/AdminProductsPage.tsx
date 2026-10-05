import { Pencil, Plus } from "lucide-react";
import { useStore } from "../../app/providers/store";
import { Badge } from "../../components/shared/Badge";
import { ButtonLink } from "../../components/shared/Button";
import { PageHeader } from "../../components/shared/PageHeader";
import { useToast } from "../../components/shared/Toast";
import { NEED_LABELS } from "../../engine";
import { formatDate } from "../../utils/format";
import { CATEGORY_META } from "../../utils/labels";

export function AdminProductsPage() {
  const { state, dispatch } = useStore();
  const toast = useToast();
  return (
    <div>
      <PageHeader
        eyebrow="Catalogue"
        title="Product catalogue"
        body="The structured source of truth the engine matches against. Every change is versioned and audited."
        actions={<ButtonLink to="/admin/products/new" icon={<Plus size={20} aria-hidden />}>New product</ButtonLink>}
      />
      <p className="mb-4 rounded-[12px] border border-[#fbe2b6] bg-amber-50 p-3 text-small text-amber-700">
        Prototype catalogue. Actual Zenith product names, terms, eligibility, fees and requirements must be sourced from the bank's approved catalogue before production.
      </p>
      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-small">
          <thead>
            <tr className="border-b border-mist text-left text-navy-500">
              <th scope="col" className="px-5 py-3 font-medium">Product</th>
              <th scope="col" className="py-3 font-medium">Category</th>
              <th scope="col" className="py-3 font-medium">Needs served</th>
              <th scope="col" className="py-3 font-medium">Version</th>
              <th scope="col" className="py-3 font-medium">Status</th>
              <th scope="col" className="px-5 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-mist">
            {state.products.map((p) => (
              <tr key={p.product_id}>
                <th scope="row" className="px-5 py-3 text-left">
                  <span className="block font-semibold">{p.name}</span>
                  <span className="font-mono text-[12px] font-normal text-navy-500">{p.product_id}</span>
                </th>
                <td className="py-3">{CATEGORY_META[p.category].label}</td>
                <td className="py-3 pr-3 text-navy-700">{p.financial_needs.map((n) => NEED_LABELS[n]).join(", ")}</td>
                <td className="py-3 tabular-nums">v{p.version} <span className="block text-caption !font-normal text-navy-500">{formatDate(p.updated_at)}</span></td>
                <td className="py-3">
                  <button
                    type="button"
                    role="switch"
                    aria-checked={p.status === "active"}
                    aria-label={`${p.name} active`}
                    onClick={() => {
                      dispatch({ type: "upsert_product", product: { ...p, status: p.status === "active" ? "inactive" : "active" } });
                      toast(`${p.name} ${p.status === "active" ? "deactivated" : "activated"} — engine updated.`, "info");
                    }}
                    className="inline-flex min-h-11 items-center"
                  >
                    {p.status === "active" ? <Badge tone="green">Active</Badge> : <Badge>Inactive</Badge>}
                  </button>
                </td>
                <td className="px-5 py-3 text-right">
                  <ButtonLink to={`/admin/products/${p.product_id}`} size="sm" variant="tertiary" icon={<Pencil size={16} aria-hidden />}>Edit</ButtonLink>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
