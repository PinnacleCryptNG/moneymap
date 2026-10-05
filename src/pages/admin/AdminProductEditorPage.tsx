import { ArrowLeft } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useStore } from "../../app/providers/store";
import { Button } from "../../components/shared/Button";
import { Input, Select, TextArea } from "../../components/shared/Field";
import { PageHeader } from "../../components/shared/PageHeader";
import { useToast } from "../../components/shared/Toast";
import { NEED_LABELS } from "../../engine";
import type { CustomerSegment, ExistingProductId, FinancialNeed, Product, ProductCategory, Signal } from "../../types";
import { formatDateTime } from "../../utils/format";
import { CATEGORY_META } from "../../utils/labels";

const SIGNALS: Signal[] = [
  "consistent_income", "irregular_income", "income_increase", "regular_surplus", "low_surplus", "stated_savings_goal",
  "savings_in_everyday_account", "repeated_saving_behaviour", "planned_major_expense", "business_inflows", "business_growth",
  "high_transaction_volume", "high_card_spend", "no_emergency_buffer", "needs_immediate_liquidity", "large_idle_balance",
];
const HOLDINGS: ExistingProductId[] = ["current_account", "savings_account", "debit_card", "credit_card", "personal_loan", "business_account", "fixed_deposit", "investment_fund"];
const SEGMENTS: CustomerSegment[] = ["retail", "student", "business"];
const human = (s: string) => s.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

function blank(id: string): Product {
  return {
    product_id: id,
    name: "",
    category: "savings",
    purpose: "",
    description: "",
    target_customer: ["retail"],
    eligibility: { minimum_income: null, minimum_age: 18, account_required: true, minimum_balance: null, max_repayment_to_income: null },
    financial_needs: [],
    recommended_when: [],
    not_recommended_when: [],
    key_terms: [],
    fees: "",
    required_documents: [],
    application_route: "digital",
    status: "inactive",
    version: 0,
    updated_at: new Date().toISOString(),
  };
}

export function AdminProductEditorPage() {
  const { id } = useParams();
  const { state, dispatch } = useStore();
  const navigate = useNavigate();
  const toast = useToast();
  const existing = state.products.find((p) => p.product_id === id);
  const nextId = `PRODUCT_${String(state.products.length + 1).padStart(3, "0")}`;
  const [p, setP] = useState<Product>(existing ?? blank(nextId));
  const history = state.productVersions.filter((v) => v.product_id === p.product_id);

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^\d.]/g, "")));
  const valid = p.name.trim() && p.purpose.trim() && p.financial_needs.length > 0;

  const save = () => {
    dispatch({ type: "upsert_product", product: p });
    toast(existing ? `Saved ${p.name} as v${p.version + 1}.` : `Created ${p.name}.`);
    navigate("/admin/products");
  };

  return (
    <div>
      <Link to="/admin/products" className="mb-4 inline-flex min-h-11 items-center gap-1 font-medium text-blue-600 hover:underline"><ArrowLeft size={18} aria-hidden /> Catalogue</Link>
      <PageHeader eyebrow={existing ? `${p.product_id} · v${existing.version}` : "New product"} title={existing ? `Edit ${existing.name}` : "Create product"} />
      <form className="flex flex-col gap-6" onSubmit={(e) => { e.preventDefault(); if (valid) save(); }}>
        <Section title="Basics">
          <div className="grid gap-4 md:grid-cols-2">
            <Input label="Product name" required value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
            <Select label="Category" value={p.category} onChange={(e) => setP({ ...p, category: e.target.value as ProductCategory })}>
              {(Object.keys(CATEGORY_META) as ProductCategory[]).map((c) => <option key={c} value={c}>{CATEGORY_META[c].label}</option>)}
            </Select>
            <Input label="Purpose" required value={p.purpose} onChange={(e) => setP({ ...p, purpose: e.target.value })} />
            <Select label="Application route" value={p.application_route} onChange={(e) => setP({ ...p, application_route: e.target.value as Product["application_route"] })}>
              <option value="digital">Digital</option>
              <option value="branch">Branch</option>
              <option value="relationship_manager">Relationship manager</option>
            </Select>
            <div className="md:col-span-2"><TextArea label="Description" value={p.description} onChange={(e) => setP({ ...p, description: e.target.value })} /></div>
            <Select label="Status" value={p.status} onChange={(e) => setP({ ...p, status: e.target.value as Product["status"] })}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </Select>
          </div>
          <Checks legend="Customer segment" options={SEGMENTS} selected={p.target_customer} label={human} onToggle={(v) => setP({ ...p, target_customer: toggle(p.target_customer, v) })} />
        </Section>

        <Section title="Eligibility">
          <div className="grid gap-4 md:grid-cols-3">
            <Input label="Minimum age" inputMode="numeric" value={String(p.eligibility.minimum_age)} onChange={(e) => setP({ ...p, eligibility: { ...p.eligibility, minimum_age: Number(e.target.value) || 0 } })} />
            <Input label="Minimum monthly income" prefix="₦" inputMode="numeric" value={p.eligibility.minimum_income?.toString() ?? ""} onChange={(e) => setP({ ...p, eligibility: { ...p.eligibility, minimum_income: num(e.target.value) } })} hint="Leave blank for none" />
            <Input label="Minimum balance" prefix="₦" inputMode="numeric" value={p.eligibility.minimum_balance?.toString() ?? ""} onChange={(e) => setP({ ...p, eligibility: { ...p.eligibility, minimum_balance: num(e.target.value) } })} hint="Leave blank for none" />
            <Input label="Max repayment-to-income" inputMode="decimal" value={p.eligibility.max_repayment_to_income?.toString() ?? ""} onChange={(e) => setP({ ...p, eligibility: { ...p.eligibility, max_repayment_to_income: num(e.target.value) } })} hint="Financing only, e.g. 0.33" />
            <label className="flex min-h-12 items-center gap-3 self-end">
              <input type="checkbox" className="h-5 w-5 accent-[#1677FF]" checked={p.eligibility.account_required} onChange={(e) => setP({ ...p, eligibility: { ...p.eligibility, account_required: e.target.checked } })} />
              Existing account required
            </label>
          </div>
        </Section>

        <Section title="Matching rules">
          <Checks legend="Financial needs served (required)" options={Object.keys(NEED_LABELS) as FinancialNeed[]} selected={p.financial_needs} label={(n) => NEED_LABELS[n]} onToggle={(v) => setP({ ...p, financial_needs: toggle(p.financial_needs, v) })} />
          <Checks legend="Recommended when" options={SIGNALS} selected={p.recommended_when} label={human} onToggle={(v) => setP({ ...p, recommended_when: toggle(p.recommended_when, v) })} />
          <Checks legend="Exclusions — not recommended when" options={SIGNALS} selected={p.not_recommended_when} label={human} onToggle={(v) => setP({ ...p, not_recommended_when: toggle(p.not_recommended_when, v) })} />
          <Select label="Equivalent existing holding (excludes customers who have it)" value={p.equivalent_holding ?? ""} onChange={(e) => setP({ ...p, equivalent_holding: (e.target.value || undefined) as ExistingProductId | undefined })}>
            <option value="">None</option>
            {HOLDINGS.map((h) => <option key={h} value={h}>{human(h)}</option>)}
          </Select>
        </Section>

        <Section title="Terms & documentation">
          <div className="grid gap-4 md:grid-cols-2">
            <TextArea label="Key terms (one per line)" value={p.key_terms.join("\n")} onChange={(e) => setP({ ...p, key_terms: e.target.value.split("\n").filter(Boolean) })} />
            <TextArea label="Required documentation (one per line)" value={p.required_documents.join("\n")} onChange={(e) => setP({ ...p, required_documents: e.target.value.split("\n").filter(Boolean) })} />
            <Input label="Fees" value={p.fees} onChange={(e) => setP({ ...p, fees: e.target.value })} />
          </div>
        </Section>

        <div className="flex flex-wrap justify-end gap-3">
          <Button variant="secondary" onClick={() => navigate("/admin/products")}>Cancel</Button>
          <Button type="submit" disabled={!valid}>{existing ? `Save as v${existing.version + 1}` : "Create product"}</Button>
        </div>
      </form>

      {history.length > 0 && (
        <section className="card mt-8 p-5 md:p-6" aria-labelledby="ver-title">
          <h2 id="ver-title" className="mb-3 !text-[20px]">Version history</h2>
          <ul className="flex flex-col divide-y divide-mist text-small">
            {history.map((v) => (
              <li key={`${v.product_id}-${v.version}`} className="flex justify-between gap-3 py-2.5">
                <span><strong>v{v.version}</strong> · {v.name} · {v.status}</span>
                <span className="text-navy-500">{formatDateTime(v.updated_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card flex flex-col gap-5 p-5 md:p-6">
      <h2 className="!text-[20px]">{title}</h2>
      {children}
    </section>
  );
}

function Checks<T extends string>({ legend, options, selected, label, onToggle }: { legend: string; options: T[]; selected: T[]; label: (v: T) => string; onToggle: (v: T) => void }) {
  return (
    <fieldset>
      <legend className="mb-2 text-small font-medium">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = selected.includes(o);
          return (
            <label key={o} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-small ${on ? "border-blue bg-blue-50 text-blue-600" : "border-mist bg-white text-navy-700 hover:bg-cloud"}`}>
              <input type="checkbox" className="h-4 w-4 accent-[#1677FF]" checked={on} onChange={() => onToggle(o)} />
              {label(o)}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
