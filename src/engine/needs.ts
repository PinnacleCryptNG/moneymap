// Stage 2 — DETECT: translate context and signals into financial needs.
import type { FinancialNeed, GoalType } from "../types";
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
  surplus_management: "Making better use of surplus money",
  emergency_fund: "Building a safety buffer",
  wealth_growth: "Growing money over time",
  expense_financing: "Financing a planned expense",
  business_banking: "Banking that fits a growing business",
  everyday_banking: "Smoother everyday payments",
  financial_protection: "Protecting against the unexpected",
};

/** Needs that a goal type directly expresses (primary) or relates to (secondary). */
export const GOAL_NEEDS: Record<GoalType, { primary: FinancialNeed[]; secondary: FinancialNeed[] }> = {
  save_more: { primary: ["goal_saving"], secondary: ["surplus_management", "emergency_fund"] },
  grow_money: { primary: ["wealth_growth"], secondary: ["surplus_management"] },
  major_expense: { primary: ["expense_financing", "goal_saving"], secondary: [] },
  everyday: { primary: ["everyday_banking"], secondary: [] },
  grow_business: { primary: ["business_banking"], secondary: [] },
  protect: { primary: ["financial_protection", "emergency_fund"], secondary: [] },
  not_sure: { primary: [], secondary: [] },
};

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

  const surplus = hasSignal(ctx, "regular_surplus");
  const goal = ctx.goal;

  if (goal) {
    switch (goal.type) {
      case "save_more":
        raise("goal_saving", 85, "You set a savings goal.");
        break;
      case "grow_money":
        raise("wealth_growth", 85, "You told us you want to grow your money.");
        break;
      case "major_expense": {
        const plan = goalPlan(goal, ctx.surplus?.average ?? null);
        if (plan.affordableFromSurplus === true) {
          raise("goal_saving", 85, "Your surplus can cover your planned expense in time if you save for it.");
        } else {
          raise(
            "expense_financing",
            ctx.surplus ? 85 : 70,
            ctx.surplus
              ? "Your planned expense is larger than you can save from surplus before it's due."
              : "You're planning a major expense.",
          );
        }
        break;
      }
      case "grow_business":
        raise("business_banking", 80, "You told us you want to grow your business.");
        break;
      case "protect":
        raise("financial_protection", 85, "You told us you want to protect your finances.");
        break;
      case "everyday":
        raise("everyday_banking", 75, "You want to manage your everyday money better.");
        break;
      case "not_sure":
        break;
    }
  }

  if (surplus) {
    raise("surplus_management", 55 + 20 * surplus.strength, "You regularly keep surplus money after spending.");
    if (hasSignal(ctx, "savings_in_everyday_account")) {
      raise("goal_saving", 80, "You're saving, but in your everyday account.");
      raise("surplus_management", 80, "Your saved money is mixed with your spending money.");
    }
  }
  const increase = hasSignal(ctx, "income_increase");
  if (increase) raise("wealth_growth", 65 + 20 * increase.strength, "Your income has increased significantly.");
  const idle = hasSignal(ctx, "large_idle_balance");
  if (idle) {
    raise("wealth_growth", 70 + 15 * idle.strength, "You hold a large balance in your everyday account.");
    raise("surplus_management", 75, "Money sitting idle could be working harder for you.");
  }
  const business = hasSignal(ctx, "business_inflows");
  if (business) raise("business_banking", 60 + 15 * business.strength, "Business payments flow through your account.");
  const bgrowth = hasSignal(ctx, "business_growth");
  if (bgrowth) raise("business_banking", 80 + 15 * bgrowth.strength, "Your business activity has grown quickly.");
  if (hasSignal(ctx, "high_transaction_volume") && business) {
    raise("business_banking", 85, "Your transaction volume is outgrowing a personal account.");
  }
  if (hasSignal(ctx, "no_emergency_buffer")) {
    raise("emergency_fund", 65, "Your balance would not cover a month of spending if something unexpected happened.");
  }
  if (hasSignal(ctx, "high_card_spend")) {
    raise("everyday_banking", 60, "Most of your payments are made by card.");
  }

  return [...needs.values()]
    .map((n) => ({ ...n, strength: Math.round(Math.min(100, n.strength)) }))
    .sort((a, b) => b.strength - a.strength);
}
