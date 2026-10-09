import { Plus, X } from "lucide-react";
import { useId } from "react";
import type { AccountKind, Amount, SelfReport } from "../../types";
import { formatNaira } from "../../utils/format";

// ---------- Draft state: what the form holds while the customer types ----------

export interface AmountDraft {
  kind: "exact" | "range" | "unsure";
  value: string;
  min: string;
  max: string;
}

export interface GoalDraftRow {
  label: string;
  amount: string;
  months: string;
}

export interface MoneyDraft {
  accounts: Record<AccountKind, { on: boolean; amount: AmountDraft }>;
  hasFixed: "yes" | "no" | null;
  fixed: AmountDraft;
  hasVariable: "yes" | "no" | null;
  variable: { title: string; amount: AmountDraft }[];
  expensesMode: "total" | "itemised" | "unsure" | null;
  total: AmountDraft;
  items: { category: string; amount: AmountDraft }[];
  newGoals: GoalDraftRow[];
}

export const ACCOUNT_KINDS: { kind: AccountKind; label: string }[] = [
  { kind: "personal", label: "Personal account" },
  { kind: "business", label: "Business account" },
  { kind: "savings", label: "Savings account" },
  { kind: "investment", label: "Investment account" },
];

export const EXPENSE_CATEGORIES = ["Food", "Rent", "Electricity", "Transport", "Airtime & data", "School fees", "Family support"];

export const GOAL_SUGGESTIONS: GoalDraftRow[] = [
  { label: "School fees", amount: "100000", months: "6" },
  { label: "New phone", amount: "200000", months: "6" },
];

const blank = (kind: AmountDraft["kind"] = "exact"): AmountDraft => ({ kind, value: "", min: "", max: "" });

const toDraft = (a: Amount | undefined, fallback: AmountDraft["kind"] = "exact"): AmountDraft =>
  !a
    ? blank(fallback)
    : a.kind === "exact"
      ? { ...blank("exact"), value: String(a.value) }
      : a.kind === "range"
        ? { ...blank("range"), min: String(a.min), max: String(a.max) }
        : blank("unsure");

export function draftFrom(r: SelfReport | null): MoneyDraft {
  const accounts = Object.fromEntries(
    ACCOUNT_KINDS.map(({ kind }) => {
      const a = r?.accounts.find((x) => x.kind === kind);
      return [kind, { on: Boolean(a), amount: toDraft(a?.amount) }];
    }),
  ) as MoneyDraft["accounts"];
  const itemised = r?.expenses.mode === "itemised" ? r.expenses.items : [];
  return {
    accounts,
    hasFixed: r ? (r.fixedIncome ? "yes" : "no") : null,
    fixed: toDraft(r?.fixedIncome ?? undefined),
    hasVariable: r ? (r.variableIncome.length ? "yes" : "no") : null,
    variable: r?.variableIncome.length ? r.variableIncome.map((v) => ({ title: v.title, amount: toDraft(v.amount) })) : [{ title: "", amount: blank("range") }],
    expensesMode: r ? r.expenses.mode : null,
    total: toDraft(r?.expenses.mode === "total" ? r.expenses.total : undefined, "range"),
    items: [
      ...EXPENSE_CATEGORIES.map((category) => ({ category, amount: toDraft(itemised.find((i) => i.category === category)?.amount) })),
      ...itemised.filter((i) => !EXPENSE_CATEGORIES.includes(i.category)).map((i) => ({ category: i.category, amount: toDraft(i.amount) })),
    ],
    newGoals: [],
  };
}

const num = (s: string) => Number(s.replace(/[^\d]/g, ""));

/** Turn one answer into an Amount. Blank = not answered (null). */
function readAmount(d: AmountDraft, what: string, errors: string[]): Amount | null {
  if (d.kind === "unsure") return { kind: "unsure" };
  if (d.kind === "exact") return d.value.trim() === "" ? null : { kind: "exact", value: num(d.value) };
  if (d.min.trim() === "" && d.max.trim() === "") return null;
  if (d.min.trim() === "" || d.max.trim() === "") {
    errors.push(`${what}: enter both ends of the range.`);
    return null;
  }
  const min = num(d.min);
  const max = num(d.max);
  if (min >= max) {
    errors.push(`${what}: the first amount should be lower than the second.`);
    return null;
  }
  return { kind: "range", min, max };
}

/** The answers to save, plus anything that needs fixing first. */
export function readDraft(d: MoneyDraft): { report: Omit<SelfReport, "updatedAt">; goals: GoalDraftRow[]; errors: string[] } {
  const errors: string[] = [];
  const accounts = ACCOUNT_KINDS.filter(({ kind }) => d.accounts[kind].on).map(({ kind, label }) => ({
    kind,
    amount: readAmount(d.accounts[kind].amount, label, errors) ?? ({ kind: "unsure" } as Amount),
  }));
  const fixedIncome = d.hasFixed === "yes" ? readAmount(d.fixed, "Fixed monthly income", errors) : null;
  if (d.hasFixed === "yes" && !fixedIncome && !errors.length) errors.push("Fixed monthly income: enter an amount, a range, or choose “I'm not sure”.");
  const variableIncome =
    d.hasVariable === "yes"
      ? d.variable.flatMap((v, i) => {
          const amount = readAmount(v.amount, v.title.trim() || `Income ${i + 1}`, errors);
          if (!v.title.trim() && !amount) return [];
          if (!v.title.trim()) {
            errors.push(`Give income ${i + 1} a name, like “Fashion business”.`);
            return [];
          }
          return [{ title: v.title.trim().slice(0, 60), amount: amount ?? ({ kind: "unsure" } as Amount) }];
        })
      : [];
  let expenses: SelfReport["expenses"] = { mode: "unsure" };
  if (d.expensesMode === "total") {
    const total = readAmount(d.total, "Monthly expenses", errors);
    expenses = total ? { mode: "total", total } : { mode: "unsure" };
  } else if (d.expensesMode === "itemised") {
    const items = d.items.flatMap((i) => {
      const amount = readAmount(i.amount, i.category || "Expense", errors);
      return amount && i.category.trim() ? [{ category: i.category.trim().slice(0, 60), amount }] : [];
    });
    expenses = items.length ? { mode: "itemised", items } : { mode: "unsure" };
  }
  const goals = d.newGoals.filter((g) => g.label.trim() || g.amount.trim());
  goals.forEach((g, i) => {
    if (!g.label.trim()) errors.push(`Savings goal ${i + 1}: say what it's for.`);
    if (num(g.amount) < 1000) errors.push(`Savings goal ${i + 1}: enter an amount of at least ₦1,000.`);
    const m = num(g.months);
    if (!m || m > 120) errors.push(`Savings goal ${i + 1}: choose a timeline between 1 and 120 months.`);
  });
  return { report: { accounts, fixedIncome, variableIncome, expenses }, goals, errors };
}

// ---------- Inputs ----------

const control =
  "w-full min-h-12 rounded-[10px] border border-line bg-surface px-3.5 text-ink placeholder:text-ink-3/70 focus:border-blue focus:outline-none focus:ring-3 focus:ring-blue/20";

function NairaInput({ label, display, value, onChange, hideLabel }: { label: string; display?: string; value: string; onChange: (v: string) => void; hideLabel?: boolean }) {
  const id = useId();
  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <label htmlFor={id} className={hideLabel ? "sr-only" : "text-caption font-medium text-ink-3"}>{display ?? label}</label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-3">₦</span>
        <input
          id={id}
          aria-label={display ? label : undefined}
          inputMode="numeric"
          className={`${control} pl-8`}
          value={value ? Number(num(value)).toLocaleString("en-NG") : ""}
          onChange={(e) => onChange(e.target.value.replace(/[^\d]/g, ""))}
        />
      </div>
    </div>
  );
}

/** An amount answer: exact figure, a range, or "I'm not sure". */
export function AmountField({ label, value, onChange }: { label: string; value: AmountDraft; onChange: (v: AmountDraft) => void }) {
  const set = (patch: Partial<AmountDraft>) => onChange({ ...value, ...patch });
  const modes: { kind: AmountDraft["kind"]; label: string }[] = [
    { kind: "exact", label: "Amount" },
    { kind: "range", label: "Range" },
    { kind: "unsure", label: "I'm not sure" },
  ];
  return (
    <div className="flex flex-col gap-2">
      <div role="radiogroup" aria-label={`${label}: how would you like to answer?`} className="flex flex-wrap gap-1.5">
        {modes.map((m) => (
          <button
            key={m.kind}
            type="button"
            role="radio"
            aria-checked={value.kind === m.kind}
            onClick={() => set({ kind: m.kind })}
            className={`min-h-9 rounded-full border px-3 text-small font-medium ${value.kind === m.kind ? "border-blue bg-blue-50 text-blue-600" : "border-line bg-surface text-ink-2 hover:bg-canvas"}`}
          >
            {m.label}
          </button>
        ))}
      </div>
      {value.kind === "exact" && <NairaInput label={label} hideLabel value={value.value} onChange={(v) => set({ value: v })} />}
      {value.kind === "range" && (
        <div className="flex items-end gap-2">
          <NairaInput label={`${label} — from`} display="From" value={value.min} onChange={(v) => set({ min: v })} />
          <span className="pb-3 text-ink-3" aria-hidden>–</span>
          <NairaInput label={`${label} — to`} display="To" value={value.max} onChange={(v) => set({ max: v })} />
        </div>
      )}
      {value.kind === "unsure" && <p className="text-caption !font-normal text-ink-3">No problem — MoneyMap won't guess this figure.</p>}
    </div>
  );
}

function YesNo({ legend, value, onChange }: { legend: string; value: "yes" | "no" | null; onChange: (v: "yes" | "no") => void }) {
  return (
    <div role="radiogroup" aria-label={legend} className="flex gap-2">
      {(["yes", "no"] as const).map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={value === v}
          onClick={() => onChange(v)}
          className={`min-h-11 min-w-20 rounded-[10px] border px-4 font-medium ${value === v ? "border-blue bg-blue-50 text-blue-600" : "border-line bg-surface text-ink-2 hover:bg-canvas"}`}
        >
          {v === "yes" ? "Yes" : "No"}
        </button>
      ))}
    </div>
  );
}

function Question({ n, title, hint, children }: { n: number; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card flex flex-col gap-4 p-5 md:p-6" aria-labelledby={`q${n}`}>
      <div>
        <h2 id={`q${n}`} className="!text-[20px]">{title}</h2>
        {hint && <p className="mt-1 text-small text-ink-3">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const RemoveButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button type="button" aria-label={label} onClick={onClick} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink-3 hover:bg-canvas">
    <X size={18} aria-hidden />
  </button>
);

const AddButton = ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => (
  <button type="button" onClick={onClick} className="inline-flex min-h-11 items-center gap-1.5 self-start rounded-[10px] px-2 font-semibold text-blue-600 hover:bg-blue-50">
    <Plus size={18} aria-hidden /> {children}
  </button>
);

// ---------- The questions ----------

export function MoneyQuestions({
  draft,
  onChange,
  existingGoals,
}: {
  draft: MoneyDraft;
  onChange: (d: MoneyDraft) => void;
  /** Goals the customer already has, shown so they don't add the same one twice. */
  existingGoals: { label: string }[];
}) {
  const set = (patch: Partial<MoneyDraft>) => onChange({ ...draft, ...patch });
  const textInput = `${control} min-w-0 flex-1`;

  return (
    <div className="flex flex-col gap-4">
      <Question n={1} title="How much is in each of your bank accounts?" hint="Tick every type you have, at Zenith or any other bank.">
        <div className="flex flex-col gap-3">
          {ACCOUNT_KINDS.map(({ kind, label }) => {
            const a = draft.accounts[kind];
            return (
              <div key={kind} className={`rounded-[12px] border p-3 ${a.on ? "border-blue/40 bg-blue-50/30" : "border-line"}`}>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 font-medium">
                  <input
                    type="checkbox"
                    className="h-5 w-5 accent-green-700"
                    checked={a.on}
                    onChange={(e) => set({ accounts: { ...draft.accounts, [kind]: { ...a, on: e.target.checked } } })}
                  />
                  {label}
                </label>
                {a.on && (
                  <div className="mt-2 pl-8">
                    <AmountField label={label} value={a.amount} onChange={(amount) => set({ accounts: { ...draft.accounts, [kind]: { ...a, amount } } })} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Question>

      <Question n={2} title={existingGoals.length ? "Any other savings goals?" : "Any savings goals?"} hint="Add as many as you like. Tap a suggestion or write your own.">
        {existingGoals.length > 0 && (
          <p className="text-small text-ink-3">Already saved: {existingGoals.map((g) => g.label).join(" · ")}</p>
        )}
        <div className="flex flex-wrap gap-2">
          {GOAL_SUGGESTIONS.filter((s) => !draft.newGoals.some((g) => g.label === s.label)).map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => set({ newGoals: [...draft.newGoals, s] })}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-small font-medium hover:bg-canvas"
            >
              <Plus size={14} aria-hidden /> {formatNaira(Number(s.amount))} for {s.label.toLowerCase()}
            </button>
          ))}
        </div>
        {draft.newGoals.map((g, i) => (
          <div key={i} className="flex flex-col gap-2 rounded-[12px] border border-line p-3 sm:flex-row sm:items-end">
            <div className="flex min-w-0 flex-[2] flex-col gap-1">
              <label className="text-caption font-medium text-ink-3" htmlFor={`goal-${i}-label`}>What for?</label>
              <input id={`goal-${i}-label`} className={textInput} value={g.label} placeholder="e.g. School fees" onChange={(e) => set({ newGoals: draft.newGoals.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })} />
            </div>
            <NairaInput label="Amount" value={g.amount} onChange={(amount) => set({ newGoals: draft.newGoals.map((x, j) => (j === i ? { ...x, amount } : x)) })} />
            <div className="flex w-full flex-col gap-1 sm:w-28">
              <label className="text-caption font-medium text-ink-3" htmlFor={`goal-${i}-months`}>In (months)</label>
              <input id={`goal-${i}-months`} inputMode="numeric" className={control} value={g.months} onChange={(e) => set({ newGoals: draft.newGoals.map((x, j) => (j === i ? { ...x, months: e.target.value.replace(/[^\d]/g, "") } : x)) })} />
            </div>
            <RemoveButton label={`Remove goal ${g.label || i + 1}`} onClick={() => set({ newGoals: draft.newGoals.filter((_, j) => j !== i) })} />
          </div>
        ))}
        <AddButton onClick={() => set({ newGoals: [...draft.newGoals, { label: "", amount: "", months: "12" }] })}>Add a savings goal</AddButton>
      </Question>

      <Question n={3} title="Do you have a fixed monthly income?" hint="Such as a salary that's about the same every month.">
        <YesNo legend="Do you have a fixed monthly income?" value={draft.hasFixed} onChange={(hasFixed) => set({ hasFixed })} />
        {draft.hasFixed === "yes" && <AmountField label="Fixed monthly income" value={draft.fixed} onChange={(fixed) => set({ fixed })} />}
      </Question>

      <Question
        n={4}
        title="Do you have income that changes from month to month?"
        hint="For example a business, side hustle or freelance work where you can't say exactly what you'll make. Give each one a name."
      >
        <YesNo legend="Do you have income that changes from month to month?" value={draft.hasVariable} onChange={(hasVariable) => set({ hasVariable })} />
        {draft.hasVariable === "yes" && (
          <>
            {draft.variable.map((v, i) => (
              <div key={i} className="flex flex-col gap-3 rounded-[12px] border border-line p-3">
                <div className="flex items-end gap-2">
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <label className="text-caption font-medium text-ink-3" htmlFor={`var-${i}`}>Name this income</label>
                    <input id={`var-${i}`} className={textInput} value={v.title} placeholder="e.g. Fashion business" onChange={(e) => set({ variable: draft.variable.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                  </div>
                  {draft.variable.length > 1 && <RemoveButton label={`Remove ${v.title || `income ${i + 1}`}`} onClick={() => set({ variable: draft.variable.filter((_, j) => j !== i) })} />}
                </div>
                <AmountField label={v.title || `Income ${i + 1}`} value={v.amount} onChange={(amount) => set({ variable: draft.variable.map((x, j) => (j === i ? { ...x, amount } : x)) })} />
              </div>
            ))}
            <AddButton onClick={() => set({ variable: [...draft.variable, { title: "", amount: blank("range") }] })}>Add another income</AddButton>
          </>
        )}
      </Question>

      <Question n={5} title="Do you have a rough idea of your monthly expenses?" hint="Give one total, or break it down. Use a range if it changes, or choose “I'm not sure” for anything you don't know.">
        <div role="radiogroup" aria-label="How would you like to answer about expenses?" className="flex flex-wrap gap-2">
          {([
            ["total", "One total"],
            ["itemised", "Break it down"],
            ["unsure", "I'm not sure"],
          ] as const).map(([mode, text]) => (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={draft.expensesMode === mode}
              onClick={() => set({ expensesMode: mode })}
              className={`min-h-11 rounded-[10px] border px-4 font-medium ${draft.expensesMode === mode ? "border-blue bg-blue-50 text-blue-600" : "border-line bg-surface text-ink-2 hover:bg-canvas"}`}
            >
              {text}
            </button>
          ))}
        </div>
        {draft.expensesMode === "total" && <AmountField label="Total monthly expenses" value={draft.total} onChange={(total) => set({ total })} />}
        {draft.expensesMode === "itemised" && (
          <div className="flex flex-col gap-3">
            {draft.items.map((it, i) => (
              <div key={i} className="flex flex-col gap-2 rounded-[12px] border border-line p-3">
                <div className="flex items-center justify-between gap-2">
                  {i < EXPENSE_CATEGORIES.length ? (
                    <p className="font-medium">{it.category}{it.category === "Rent" && <span className="text-small font-normal text-ink-3"> · paid yearly? Divide by 12</span>}</p>
                  ) : (
                    <input aria-label={`Expense ${i + 1} name`} className={textInput} value={it.category} placeholder="e.g. Church offering" onChange={(e) => set({ items: draft.items.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)) })} />
                  )}
                  {i >= EXPENSE_CATEGORIES.length && <RemoveButton label={`Remove ${it.category || "expense"}`} onClick={() => set({ items: draft.items.filter((_, j) => j !== i) })} />}
                </div>
                <AmountField label={it.category || `Expense ${i + 1}`} value={it.amount} onChange={(amount) => set({ items: draft.items.map((x, j) => (j === i ? { ...x, amount } : x)) })} />
              </div>
            ))}
            <AddButton onClick={() => set({ items: [...draft.items, { category: "", amount: blank() }] })}>Add another expense</AddButton>
          </div>
        )}
        {draft.expensesMode === "unsure" && <p className="text-small text-ink-3">That's fine. If you let MoneyMap read your Zenith account next, it can work this out for you.</p>}
      </Question>
    </div>
  );
}

/**
 * Save the answers and any new savings goals. New goals don't replace a goal that's already active,
 * unless there isn't one.
 */
export function saveMoneyAnswers(
  dispatch: (a: import("../../app/providers/store").Action) => void,
  read: ReturnType<typeof readDraft>,
  hasActiveGoal: boolean,
) {
  dispatch({ type: "set_self_report", report: read.report });
  read.goals.forEach((g, i) => {
    const amount = num(g.amount);
    dispatch({
      type: "upsert_goal",
      goal: { type: "save_more", label: `Save ${formatNaira(amount)} for ${g.label.trim().toLowerCase()}`, amount, timelineMonths: num(g.months), saved: 0 },
      activate: !hasActiveGoal && i === 0,
    });
  });
}

/** Did the customer answer anything at all? */
export function answeredAnything(r: Omit<SelfReport, "updatedAt">, goals: GoalDraftRow[]) {
  return r.accounts.length > 0 || r.fixedIncome !== null || r.variableIncome.length > 0 || r.expenses.mode !== "unsure" || goals.length > 0;
}
