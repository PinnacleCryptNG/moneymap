// Transparent goal and affordability calculations. All values are estimates.
import type { GoalDraft } from "../types";

export interface GoalPlan {
  target: number;
  saved: number;
  remaining: number;
  timelineMonths: number;
  /** Suggested monthly contribution to reach the target on time. */
  monthlyContribution: number;
  progressPct: number;
  /** null when surplus is unknown (spending/income not permitted). */
  affordableFromSurplus: boolean | null;
  /** Share of average monthly surplus the contribution would use. */
  shareOfSurplus: number | null;
  /** Months to reach the target if the full surplus were saved. */
  monthsAtFullSurplus: number | null;
}

export function goalPlan(goal: GoalDraft, monthlySurplus: number | null): GoalPlan {
  const saved = goal.saved ?? 0;
  const remaining = Math.max(0, goal.amount - saved);
  const months = Math.max(1, goal.timelineMonths);
  const monthlyContribution = Math.round(remaining / months);
  const known = monthlySurplus !== null && monthlySurplus > 0;
  return {
    target: goal.amount,
    saved,
    remaining,
    timelineMonths: months,
    monthlyContribution,
    progressPct: goal.amount > 0 ? Math.min(100, (saved / goal.amount) * 100) : 0,
    affordableFromSurplus: monthlySurplus === null ? null : known && monthlySurplus >= monthlyContribution,
    shareOfSurplus: known ? monthlyContribution / monthlySurplus! : null,
    monthsAtFullSurplus: known ? Math.ceil(remaining / monthlySurplus!) : null,
  };
}

/** Prototype-only illustrative loan maths (flat monthly rate). Not an offer. */
export const ILLUSTRATIVE_MONTHLY_RATE = 0.025;
export const ILLUSTRATIVE_TENOR_MONTHS = 12;

export function loanEstimate(principal: number, tenorMonths = ILLUSTRATIVE_TENOR_MONTHS) {
  const totalInterest = principal * ILLUSTRATIVE_MONTHLY_RATE * tenorMonths;
  const monthly = Math.ceil((principal + totalInterest) / tenorMonths);
  return { principal, tenorMonths, monthly, totalRepayable: principal + totalInterest };
}
