import { Flag, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useStore } from "../../app/providers/store";
import { GoalCard } from "../../components/goals/GoalCard";
import { Badge } from "../../components/shared/Badge";
import { Button } from "../../components/shared/Button";
import { Input, Select } from "../../components/shared/Field";
import { Modal } from "../../components/shared/Modal";
import { PageHeader } from "../../components/shared/PageHeader";
import { EmptyState } from "../../components/shared/States";
import { useToast } from "../../components/shared/Toast";
import { goalPlan } from "../../engine/plan";
import { useEngineResult } from "../../services/recommendation";
import type { ExpenseKind, FinancialGoal, GoalType } from "../../types";
import { formatNaira } from "../../utils/format";
import { EXPENSE_KINDS, GOAL_META, GOAL_ORDER, goalInputError } from "../../utils/labels";

interface Draft { id?: string; type: GoalType; label: string; amount: string; months: string; saved: string; expenseKind: ExpenseKind }

const empty: Draft = { type: "save_more", label: "", amount: "", months: "12", saved: "0", expenseKind: "rent" };

export function GoalsPage() {
  const { state, dispatch, activeGoal } = useStore();
  const toast = useToast();
  const result = useEngineResult();
  const surplus = result.context.surplus?.average ?? null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [contrib, setContrib] = useState<FinancialGoal | null>(null);
  const [contribAmount, setContribAmount] = useState("");

  const draftError = draft ? goalInputError(Number(draft.amount), Number(draft.months), GOAL_META[draft.type].needsAmount) : null;

  const save = () => {
    if (!draft || draftError) return;
    const meta = GOAL_META[draft.type];
    const amount = meta.needsAmount ? Number(draft.amount) || 0 : 0;
    const kind = draft.type === "major_expense" ? draft.expenseKind : undefined;
    dispatch({
      type: "upsert_goal",
      goal: {
        id: draft.id,
        type: draft.type,
        label:
          draft.label.trim() ||
          (draft.type === "save_more" && amount
            ? `Save ${formatNaira(amount)}`
            : kind
              ? EXPENSE_KINDS.find((k) => k.value === kind)!.goalLabel
              : meta.label),
        expenseKind: kind,
        amount,
        timelineMonths: Math.max(1, Number(draft.months) || 12),
        saved: Number(draft.saved) || 0,
      },
    });
    toast(draft.id ? "Goal updated." : "Goal created — MoneyMap will use it to find your path.");
    setDraft(null);
  };

  const plan = draft && GOAL_META[draft.type].needsAmount && Number(draft.amount) > 0
    ? goalPlan({ type: draft.type, label: "", amount: Number(draft.amount), timelineMonths: Number(draft.months) || 12, saved: Number(draft.saved) || 0 }, surplus)
    : null;

  return (
    <div>
      <PageHeader
        eyebrow="My goals"
        title="Where you're going"
        body="Your goals are the starting point. Recommendations are matched to your active goal."
        actions={<Button icon={<Plus size={20} aria-hidden />} onClick={() => setDraft(empty)}>New goal</Button>}
      />
      {!state.permissions.financial_goals && state.goals.length > 0 && (
        <p className="mb-4 rounded-[12px] border border-amber/40 bg-amber-50 p-3 text-small text-amber-700">
          You haven't allowed MoneyMap to use your financial goals, so they aren't shaping recommendations. You can change this in Settings.
        </p>
      )}
      {state.goals.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="Give your money somewhere to go."
          body="Tell MoneyMap what you're working towards and we'll help you find the financial path that fits."
          actions={<Button onClick={() => setDraft(empty)}>Set a goal</Button>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {state.goals.map((g) => {
            const active = g.id === activeGoal?.id;
            return (
              <li key={g.id}>
                <GoalCard goal={g} surplus={surplus}>
                  <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-line pt-4">
                    {active ? <Badge tone="green">Active goal</Badge> : (
                      <Button size="sm" variant="secondary" onClick={() => dispatch({ type: "set_active_goal", id: g.id })}>Make active</Button>
                    )}
                    {g.amount > 0 && (
                      <Button size="sm" variant="tertiary" onClick={() => { setContrib(g); setContribAmount(""); }}>Log progress</Button>
                    )}
                    <span className="ml-auto flex gap-1">
                      <Button size="sm" variant="tertiary" aria-label={`Edit ${g.label}`} onClick={() => setDraft({ id: g.id, type: g.type, label: g.label, amount: String(g.amount || ""), months: String(g.timelineMonths), saved: String(g.saved), expenseKind: g.expenseKind ?? "rent" })}>
                        <Pencil size={18} aria-hidden />
                      </Button>
                      <Button size="sm" variant="danger" aria-label={`Delete ${g.label}`} onClick={() => { dispatch({ type: "delete_goal", id: g.id }); toast("Goal deleted."); }}>
                        <Trash2 size={18} aria-hidden />
                      </Button>
                    </span>
                  </div>
                </GoalCard>
              </li>
            );
          })}
        </ul>
      )}

      <Modal open={draft !== null} onClose={() => setDraft(null)} title={draft?.id ? "Edit goal" : "New goal"}>
        {draft && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
            <Select label="What are you working towards?" value={draft.type} onChange={(e) => setDraft({ ...draft, type: e.target.value as GoalType })}>
              {GOAL_ORDER.map((t) => <option key={t} value={t}>{GOAL_META[t].label}</option>)}
            </Select>
            <Input label="Name (optional)" placeholder={GOAL_META[draft.type].label} value={draft.label} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
            {draft.type === "major_expense" && (
              <Select label="What's the expense for?" value={draft.expenseKind} onChange={(e) => setDraft({ ...draft, expenseKind: e.target.value as ExpenseKind })}>
                {EXPENSE_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
              </Select>
            )}
            {GOAL_META[draft.type].needsAmount && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input label="Target amount" prefix="₦" inputMode="numeric" required value={draft.amount} onChange={(e) => setDraft({ ...draft, amount: e.target.value.replace(/[^\d]/g, "") })} />
                <Input label="Timeline (months)" inputMode="numeric" value={draft.months} onChange={(e) => setDraft({ ...draft, months: e.target.value.replace(/[^\d]/g, "") })} />
                <Input label="Already saved" prefix="₦" inputMode="numeric" value={draft.saved} onChange={(e) => setDraft({ ...draft, saved: e.target.value.replace(/[^\d]/g, "") })} />
              </div>
            )}
            {draftError && (draft.amount || draft.months !== "12") && <p role="alert" className="text-small font-medium text-red">{draftError}</p>}
            {plan && !draftError && (
              <div className="rounded-[12px] bg-canvas p-4 text-small">
                <p className="mb-1 text-caption uppercase tracking-wide text-ink-3">Estimate</p>
                <p>Suggested monthly contribution: <strong>{formatNaira(plan.monthlyContribution)}</strong></p>
                {plan.shareOfSurplus !== null && (
                  <p className="text-ink-3">That's about {Math.round(plan.shareOfSurplus * 100)}% of your average monthly surplus.{plan.shareOfSurplus > 1 ? " It may be more than you can comfortably set aside — consider a longer timeline." : ""}</p>
                )}
              </div>
            )}
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" disabled={Boolean(draftError)}>Save goal</Button>
            </div>
          </form>
        )}
      </Modal>

      <Modal open={contrib !== null} onClose={() => setContrib(null)} title="Log progress">
        {contrib && (
          <form className="flex flex-col gap-4" onSubmit={(e) => { e.preventDefault(); dispatch({ type: "contribute", id: contrib.id, amount: Number(contribAmount) || 0 }); toast("Progress updated."); setContrib(null); }}>
            <Input label={`Amount added to "${contrib.label}"`} prefix="₦" inputMode="numeric" autoFocus value={contribAmount} onChange={(e) => setContribAmount(e.target.value.replace(/[^\d]/g, ""))} />
            <div className="flex justify-end gap-3">
              <Button variant="secondary" onClick={() => setContrib(null)}>Cancel</Button>
              <Button type="submit" disabled={!(Number(contribAmount) > 0) || Number(contribAmount) > 1_000_000_000}>Add</Button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
