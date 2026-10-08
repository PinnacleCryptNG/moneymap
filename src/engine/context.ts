// Stage 1 — UNDERSTAND: build the customer's financial context from permitted data only.
import type {
  CustomerProfile,
  ExistingProductId,
  FinancialGoal,
  PermissionKey,
  Permissions,
  Signal,
} from "../types";
import { average, clamp, formatNaira } from "../utils/format";

export interface DetectedSignal {
  signal: Signal;
  /** 0–1 confidence/strength of the signal. */
  strength: number;
  evidence: string;
  source: PermissionKey;
}

export interface FinancialContext {
  permissions: Permissions;
  /** Basic profile (KYC) data — always known to the bank, used only for eligibility. */
  age: number;
  segment: CustomerProfile["segment"];
  income: {
    average: number;
    stability: "high" | "moderate" | "low" | "rising";
    trendPct: number;
    source: CustomerProfile["incomeSource"];
    day: number;
  } | null;
  spending: { average: number; recurring: number; level: "low" | "moderate" | "high" } | null;
  surplus: { average: number; ratio: number; positiveMonths: number } | null;
  activity: {
    averageBalance: number;
    savingMonths: number;
    digitalShare: number;
    cardSpendShare: number;
    schoolPayments: boolean;
  } | null;
  holdings: ExistingProductId[] | null;
  goal: FinancialGoal | null;
  signals: DetectedSignal[];
  /** Share of available data categories the customer has permitted (0–1). */
  coverage: number;
}

export const ALL_PERMISSIONS: PermissionKey[] = [
  "account_activity",
  "income_patterns",
  "spending_patterns",
  "existing_products",
  "financial_goals",
];

export const DEDICATED_SAVINGS: ExistingProductId[] = ["savings_account", "save4me", "eazysave"];

function stdDev(values: number[]): number {
  const m = average(values);
  return Math.sqrt(average(values.map((v) => (v - m) ** 2)));
}

function growth(values: number[]): number {
  const half = Math.floor(values.length / 2);
  const first = average(values.slice(0, half));
  const last = average(values.slice(-half));
  return first === 0 ? 0 : ((last - first) / first) * 100;
}

function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function buildFinancialContext(
  customer: CustomerProfile,
  permissions: Permissions,
  goal: FinancialGoal | null,
): FinancialContext {
  const signals: DetectedSignal[] = [];
  const add = (signal: Signal, strength: number, evidence: string, source: PermissionKey) =>
    signals.push({ signal, strength: clamp(strength, 0, 1), evidence, source });

  // Income
  let income: FinancialContext["income"] = null;
  if (permissions.income_patterns) {
    const avg = average(customer.monthlyIncome);
    const cv = stdDev(customer.monthlyIncome) / avg;
    const trendPct = growth(customer.monthlyIncome);
    const stability = trendPct >= 25 ? "rising" : cv < 0.08 ? "high" : cv < 0.2 ? "moderate" : "low";
    income = { average: avg, stability, trendPct, source: customer.incomeSource, day: customer.incomeDay };
    if (stability === "high") {
      add(
        "consistent_income",
        1 - cv / 0.16,
        `Your income has stayed within about ${Math.max(1, Math.round(cv * 100))}% of ${formatNaira(avg)} a month for the last six months.`,
        "income_patterns",
      );
    } else if (stability === "low") {
      add("irregular_income", Math.min(1, cv / 0.4), "Your monthly income has varied noticeably over the last six months.", "income_patterns");
    }
    if (trendPct >= 25) {
      add(
        "income_increase",
        Math.min(1, trendPct / 80),
        `Your income over the last three months is about ${Math.round(trendPct)}% higher than the three months before.`,
        "income_patterns",
      );
    }
    if (customer.incomeSource === "salary") {
      const employer = customer.transactions.find((t) => t.category === "salary")?.description.replace(/^Salary — /, "");
      add(
        "salary_account",
        1,
        `Your salary${employer ? ` from ${employer}` : ""} is paid into your Zenith account around the ${ordinal(customer.incomeDay)} of each month.`,
        "income_patterns",
      );
    } else if (customer.incomeSource === "allowance") {
      add(
        "allowance_income",
        0.9,
        `Most of your money arrives as a monthly allowance transfer around the ${ordinal(customer.incomeDay)}, plus small one-off payments for gigs.`,
        "income_patterns",
      );
    }
  }

  // Spending
  let spending: FinancialContext["spending"] = null;
  if (permissions.spending_patterns) {
    const avg = average(customer.monthlySpending);
    const ratio = income ? avg / income.average : 0.6;
    spending = {
      average: avg,
      recurring: customer.recurringCommitments,
      level: ratio < 0.5 ? "low" : ratio < 0.8 ? "moderate" : "high",
    };
  }

  // Surplus requires both income and spending permission.
  let surplus: FinancialContext["surplus"] = null;
  if (income && spending) {
    const monthly = customer.monthlyIncome.map((inc, i) => inc - customer.monthlySpending[i]);
    const avg = average(monthly);
    const ratio = avg / income.average;
    const positiveMonths = monthly.filter((m) => m > 0.1 * income!.average).length;
    surplus = { average: avg, ratio, positiveMonths };
    if (ratio >= 0.2 && positiveMonths >= 5) {
      add(
        "regular_surplus",
        Math.min(1, ratio / 0.4),
        `After your usual spending and commitments, about ${formatNaira(avg)} is left over each month on average.`,
        "spending_patterns",
      );
    } else if (ratio < 0.08) {
      add(
        "low_surplus",
        1 - ratio / 0.08,
        "Almost all of the money that comes in each month goes out again on spending and commitments.",
        "spending_patterns",
      );
    }
  }

  // Account activity
  let activity: FinancialContext["activity"] = null;
  if (permissions.account_activity) {
    activity = {
      averageBalance: customer.averageBalance,
      savingMonths: customer.savingMonths,
      digitalShare: customer.digitalShare,
      cardSpendShare: customer.cardSpendShare,
      schoolPayments: customer.schoolPayments,
    };
    if (customer.savingMonths >= 3) {
      add(
        "repeated_saving_behaviour",
        customer.savingMonths / 6,
        `You've left money unspent or set it aside in ${customer.savingMonths} of the last 6 months.`,
        "account_activity",
      );
    }
    const monthlySpend = spending?.average ?? null;
    if (monthlySpend !== null) {
      if (customer.averageBalance >= 3 * monthlySpend) {
        add(
          "large_idle_balance",
          Math.min(1, customer.averageBalance / (6 * monthlySpend)),
          `You usually hold about ${formatNaira(customer.averageBalance)} — more than ${Math.floor(customer.averageBalance / monthlySpend)} months of spending — in your everyday account.`,
          "account_activity",
        );
      } else if (customer.averageBalance < monthlySpend) {
        add(
          "no_emergency_buffer",
          1 - customer.averageBalance / monthlySpend,
          "Your typical balance would not cover one month of your usual spending.",
          "account_activity",
        );
      }
    }
    if (customer.schoolPayments && customer.age <= 25) {
      const school = customer.transactions.find((t) => t.category === "school");
      add(
        "student_activity",
        1,
        `Your account shows student life — payments like “${school?.description ?? "school fees"}” and campus spending.`,
        "account_activity",
      );
    }
    if (customer.digitalShare >= 0.8) {
      add(
        "digital_first",
        customer.digitalShare,
        `About ${Math.round(customer.digitalShare * 100)}% of your payments go through card, POS, transfer or app — you rarely use cash.`,
        "account_activity",
      );
    }
    if (customer.cardSpendShare >= 0.65) {
      add("high_card_spend", customer.cardSpendShare, "Most of your everyday payments are made by card.", "account_activity");
    }
  }

  // Existing relationship
  const holdings = permissions.existing_products ? customer.existingProducts : null;
  if (holdings) {
    const dedicated = holdings.filter((h) => DEDICATED_SAVINGS.includes(h));
    if (dedicated.length > 0) {
      add(
        "has_dedicated_savings",
        1,
        holdings.includes("save4me")
          ? "You already save through SAVE4ME, separate from your everyday account."
          : "You already have a separate savings account.",
        "existing_products",
      );
    } else if (activity && customer.savingMonths >= 3) {
      add(
        "savings_in_everyday_account",
        1,
        "The money you keep aside stays in the same account you spend from — you don't have a dedicated savings product.",
        "existing_products",
      );
    }
  }

  // Goals
  const permittedGoal = permissions.financial_goals ? goal : null;
  if (permittedGoal && permittedGoal.amount > 0) {
    if (permittedGoal.type === "save_more") {
      add(
        "stated_savings_goal",
        1,
        `You told us you want to save ${formatNaira(permittedGoal.amount)} in ${permittedGoal.timelineMonths} months.`,
        "financial_goals",
      );
    }
    if (permittedGoal.type === "major_expense") {
      const asset = permittedGoal.expenseKind === "vehicle" || permittedGoal.expenseKind === "equipment";
      add(
        asset ? "planned_asset_purchase" : "planned_major_expense",
        1,
        `You're planning to spend ${formatNaira(permittedGoal.amount)} on ${permittedGoal.label.toLowerCase()} within ${permittedGoal.timelineMonths} months.`,
        "financial_goals",
      );
      if (permittedGoal.timelineMonths <= 3) {
        add(
          "needs_immediate_liquidity",
          1,
          `You'll need ${formatNaira(permittedGoal.amount)} within ${permittedGoal.timelineMonths} months, so the money can't be locked away.`,
          "financial_goals",
        );
      }
    }
  }

  const coverage = ALL_PERMISSIONS.filter((p) => permissions[p]).length / ALL_PERMISSIONS.length;

  return {
    permissions,
    age: customer.age,
    segment: customer.segment,
    income,
    spending,
    surplus,
    activity,
    holdings,
    goal: permittedGoal,
    signals: dedupe(signals),
    coverage,
  };
}

function dedupe(signals: DetectedSignal[]): DetectedSignal[] {
  const map = new Map<Signal, DetectedSignal>();
  for (const s of signals) {
    const prev = map.get(s.signal);
    if (!prev || s.strength > prev.strength) map.set(s.signal, s);
  }
  return [...map.values()];
}

export function hasSignal(ctx: FinancialContext, signal: Signal): DetectedSignal | undefined {
  return ctx.signals.find((s) => s.signal === signal);
}
