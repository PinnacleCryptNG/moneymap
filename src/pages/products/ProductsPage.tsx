import { ProductCard } from "../../components/cards/ProductCard";
import { PageHeader } from "../../components/shared/PageHeader";
import { useEngineResult } from "../../services/recommendation";
import type { ProductCategory } from "../../types";
import { CATEGORY_META } from "../../utils/labels";

export function ProductsPage() {
  const result = useEngineResult(true);
  const byId = new Map(result.ranked.map((e) => [e.product.product_id, e]));
  const active = result.ranked.map((e) => e.product).filter((p) => p.status === "active");
  const categories = (Object.keys(CATEGORY_META) as ProductCategory[]).filter((c) => active.some((p) => p.category === c));

  return (
    <div>
      <PageHeader
        eyebrow="Explore"
        title="Products"
        body="Browse everything yourself. Each product shows how it fits your situation — you're always free to explore beyond what MoneyMap suggests."
      />
      <div className="flex flex-col gap-8">
        {categories.map((c) => (
          <section key={c} aria-labelledby={`cat-${c}`}>
            <h2 id={`cat-${c}`} className="mb-3 !text-[20px]">{CATEGORY_META[c].label}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {active
                .filter((p) => p.category === c)
                .map((p) => (
                  <li key={p.product_id}><ProductCard product={p} evaluation={byId.get(p.product_id)} /></li>
                ))}
            </ul>
          </section>
        ))}
      </div>
      <p className="mt-8 text-caption !font-normal text-navy-500">Prototype catalogue — names, fees and terms are illustrative, not actual Zenith product terms.</p>
    </div>
  );
}
