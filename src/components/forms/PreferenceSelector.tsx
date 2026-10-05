import { Check } from "lucide-react";
import type { Frequency, Preferences, ProductCategory } from "../../types";
import { CATEGORY_META } from "../../utils/labels";

const FREQ: { value: Frequency; label: string; hint: string }[] = [
  { value: "highly_relevant", label: "Only when highly relevant", hint: "Strong matches only (default)" },
  { value: "occasionally", label: "Occasionally", hint: "Also show potential matches" },
  { value: "auto", label: "Let MoneyMap decide", hint: "Balance relevance and timing for me" },
];

export function PreferenceSelector({ value, onChange }: { value: Preferences; onChange: (p: Preferences) => void }) {
  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-3 font-semibold">What would you like MoneyMap to help you with?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(CATEGORY_META) as ProductCategory[]).map((c) => {
            const on = value.categories[c];
            const Icon = CATEGORY_META[c].icon;
            return (
              <label key={c} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] border px-4 py-2 transition-colors ${on ? "border-blue bg-blue-50" : "border-mist bg-white hover:bg-cloud"}`}>
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={on}
                  onChange={() => onChange({ ...value, categories: { ...value.categories, [c]: !on } })}
                />
                <span className={`flex h-5 w-5 items-center justify-center rounded-[5px] border-2 peer-focus-visible:outline peer-focus-visible:outline-3 peer-focus-visible:outline-blue ${on ? "border-blue bg-blue text-white" : "border-[#b5c1cf]"}`}>
                  {on && <Check size={14} strokeWidth={3} aria-hidden />}
                </span>
                <Icon size={20} className="text-navy-500" aria-hidden />
                <span className="font-medium">{CATEGORY_META[c].label}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-3 font-semibold">Recommendation frequency</legend>
        <div className="flex flex-col gap-2">
          {FREQ.map((f) => (
            <label key={f.value} className={`flex min-h-12 cursor-pointer items-center gap-3 rounded-[12px] border px-4 py-2 ${value.frequency === f.value ? "border-blue bg-blue-50" : "border-mist bg-white hover:bg-cloud"}`}>
              <input
                type="radio"
                name="frequency"
                className="h-5 w-5 accent-[#1677FF]"
                checked={value.frequency === f.value}
                onChange={() => onChange({ ...value, frequency: f.value })}
              />
              <span>
                <span className="block font-medium">{f.label}</span>
                <span className="text-small text-navy-500">{f.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
