// Stage 2 — DETECT: translate context and signals into financial needs.
import type { FinancialGoal, FinancialNeed, GoalType } from "../types";
import { type FinancialContext, hasSignal } from "./context";
import { goalPlan } from "./plan";

export interface DetectedNeed {
  need: FinancialNeed;
  /** 0–100 */
  strength: number;
  reasons: string[];
}

export const NEED_LABELS: Record<FinancialNeed, string> = {
  goal_saving: "Saving towards a goal",
  surplus_management: "Making better use of money left over each month",
  basic_savings: "Starting a simple savings habit",
  student_banking: "Banking that fits student life",
  expense_financing: "Financing a planned expense",
  asset_financing: "Financing an asset purchase",
  flexible_payments: "More flexible card payments",
  wealth_growth: "Growing money over time",
  business_banking: "Banking for a growing business",
  financial_protection: "Protecting against the unexpected",
};

/** Needs that a goal type directly expresses (primary) or relates to (secondary). */
export const GOAL_NEEDS: Record<GoalType, { primary: FinancialNeed[]; secondary: FinancialNeed[] }> = {
  save_more: { primary: ["goal_saving"], secondary: ["surplus_management", "basic_savings"] },
  grow_money: { primary: ["wealth_growth"], secondary: ["surplus_management"] },
  major_expense: { primary: ["expense_financing", "asset_financing", "goal_saving"], secondary: [] },
  everyday: { primary: ["student_banking", "flexible_payments"], secondary: ["basic_savings"] },
  grow_business: { primary: ["business_banking"], secondary: [] },
  protect: { primary: ["financial_protection"], secondary: ["basic_savings"] },
  not_sure: { primary: [], secondary: [] },
};

export function isAssetGoal(goal: FinancialGoal | null) {
  return goal?.type === "major_expense" && (goal.expenseKind === "vehicle" || goal.expenseKind === "equipment");
}

export function detectNeeds(ctx: FinancialContext): DetectedNeed[] {
  const needs = new Map<FinancialNeed, DetectedNeed>();
  const raise = (need: FinancialNeed, strength: number, reason: string) => {
    const prev = needs.get(need);
    if (!prev) {
      needs.set(need, { need, strength, reasons: [reason] });
    } else {
      prev.strength = Math.max(prev.strength, strength);
      if (!prev.reasons.includes(reason)) prev.reasons.push(reason);
    }
  };

  const goal = ctx.goal;
  if (goal) {
    switch (goal.type) {
      case "save_more":
        if (goal.amount > 0) raise("goal_saving", 85, "You set a savings goal.");
        break;
      case "grow_money":
        raise("wealth_growth", 85, "You told us you want to grow your money.");
        break;
      case "major_expense": {
        if (goal.amount <= 0) break;
        const plan = goalPlan(goal, ctx.surplus?.average ?? null);
        const financing: FinancialNeed = isAssetGoal(goal) ? "asset_financing" : "expense_financing";
        if (plan.affordableFromSurplus === true) {
          raise("goal_saving", 85, "What you have left each month can cover this in time if you save for it.");
        } else {
          raise(
            financing,
            ctx.surplus ? 85 : 70,
            ctx.surplus
              ? "This costs more than you can save from what's left each month before it's due."
              : "You're planning a major expense.",
          );
        }
        break;
      }
      case "everyday":
        raise(ctx.segment === "student" ? "student_banking" : "flexible_payments", 60, "You want to manage your everyday money better.");
        break;
      case "grow_business":
        raise("business_banking", 80, "You told us you want to grow your business.");
        break;
      case "protect":
        raise("financial_protection", 85, "You told us you want to protect your finances.");
        break;
      case "not_sure":
        break;
    }
  }

  const surplus = hasSignal(ctx, "regular_surplus");
  if (surplus) {
    raise("surplus_management", 55 + 20 * surplus.strength, "You regularly have money left over after spending.");
    if (hasSignal(ctx, "savings_in_everyday_account")) {
      raise("goal_saving", 80, "You're saving, but in your everyday account.");
      raise("surplus_management", 80, "The money you're keeping is mixed with your spending money.");
    }
  }
  if (hasSignal(ctx, "large_idle_balance")) raise("surplus_management", 75, "A large balance is sitting in your everyday account.");
  const increase = hasSignal(ctx, "income_increase");
  if (increase) raise("wealth_growth", 60 + 20 * increase.strength, "Your income has increased significantly.");

  const student = hasSignal(ctx, "student_activity");
  if (student) {
    const digital = hasSignal(ctx, "digital_first");
    const allowance = hasSignal(ctx, "allowance_income");
    raise(
      "student_banking",
      70 + (digital ? 10 : 0) + (allowance ? 5 : 0),
      "Your account activity looks like student life, but your account isn't set up for it.",
    );
  }

  if (hasSignal(ctx, "high_card_spend") && hasSignal(ctx, "consistent_income") && hasSignal(ctx, "salary_account")) {
    raise("flexible_payments", 60, "You pay mostly by card and have a steady salary.");
  }

  const noDedicated = ctx.holdings !== null && !hasSignal(ctx, "has_dedicated_savings");
  if (noDedicated && (hasSignal(ctx, "no_emergency_buffer") || hasSignal(ctx, "low_surplus"))) {
    raise("basic_savings", 65, "You don't have any savings product yet, and your buffer is thin.");
  }

  return [...needs.values()]
    .map((n) => ({ ...n, strength: Math.round(Math.min(100, n.strength)) }))
    .sort((a, b) => b.strength - a.strength);
}
