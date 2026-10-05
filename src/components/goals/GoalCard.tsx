import { Flag } from "lucide-react";
import { goalPlan } from "../../engine/plan";
import type { FinancialGoal } from "../../types";
import { formatNaira } from "../../utils/format";
import { GOAL_META } from "../../utils/labels";
import { ProgressBar } from "../shared/ProgressBar";

export function GoalCard({ goal, surplus, children }: { goal: FinancialGoal; surplus: number | null; children?: React.ReactNode }) {
  const plan = goalPlan(goal, surplus);
  const Icon = GOAL_META[goal.type].icon;
  const hasTarget = goal.amount > 0;
  const monthsElapsed = Math.floor((Date.now() - new Date(goal.createdAt).getTime()) / (30 * 86_400_000));
  const remaining = Math.max(0, goal.timelineMonths - monthsElapsed);
  return (
    <section className="card p-6" aria-label={`Goal: ${goal.label}`}>
      <p className="eyebrow mb-4 flex items-center gap-2"><Flag size={14} aria-hidden /> Where you're going</p>
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-[12px] bg-green-50 text-green-700"><Icon size={24} aria-hidden /></span>
        <div>
          <h3>{goal.label}</h3>
          <p className="text-small text-navy-500">{GOAL_META[goal.type].label}</p>
        </div>
      </div>
      {hasTarget ? (
        <>
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-small text-navy-500">{formatNaira(plan.saved)} of {formatNaira(plan.target)}</span>
            <span className="font-semibold text-green-700">{Math.round(plan.progressPct)}%</span>
          </div>
          <ProgressBar value={plan.progressPct} label={`Progress towards ${goal.label}`} />
          <div className="mt-4 grid grid-cols-2 gap-3 text-small">
            <div className="rounded-[12px] bg-cloud p-3">
              <p className="text-navy-500">Timeline</p>
              <p className="font-semibold">{remaining} months remaining</p>
            </div>
            <div className="rounded-[12px] bg-cloud p-3">
              <p className="text-navy-500">Suggested monthly</p>
              <p className="font-semibold">{formatNaira(plan.monthlyContribution)} <span className="font-normal text-navy-500">est.</span></p>
            </div>
          </div>
        </>
      ) : (
        <p className="text-navy-500">No target amount — MoneyMap uses this goal to understand what matters to you.</p>
      )}
      {children}
    </section>
  );
}
