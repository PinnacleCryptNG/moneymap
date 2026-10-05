// Stages 3–5 — MATCH, DECIDE, EXPLAIN.
// Prototype rules + weighted scoring (Phase 1). Weights and thresholds are prototype values
// that must be validated with approved data and controlled testing before production.
import type {
  CustomerProfile,
  FeedbackType,
  FinancialGoal,
  FinancialNeed,
  PermissionKey,
  Permissions,
  Preferences,
  Product,
  ProductCategory,
  RecommendationRecord,
  Signal,
} from "../types";
import { clamp, formatNaira } from "../utils/format";
import { buildFinancialContext, type FinancialContext, hasSignal } from "./context";
import { detectNeeds, type DetectedNeed, GOAL_NEEDS, NEED_LABELS } from "./needs";
import { goalPlan, loanEstimate } from "./plan";

export const MODEL_VERSION = "rules-v1.0-prototype";

export const WEIGHTS = {
  needFit: 0.3,
  goalFit: 0.2,
  behaviourFit: 0.15,
  eligibilityFit: 0.15,
  timingFit: 0.1,
  preferenceFit: 0.1,
} as const;

export const THRESHOLDS = { strong: 80, potential: 65 } as const;

/** Max one proactive recommendation per customer per decision window. */
export const DECISION_WINDOW_DAYS = 7;
export const FATIGUE_WINDOW_DAYS = 30;
export const FATIGUE_LIMIT = 3;
export const CATEGORY_FATIGUE_LIMIT = 2;

export interface ScoreFactors {
  needFit: number;
  goalFit: number;
  behaviourFit: number;
  eligibilityFit: number;
  timingFit: number;
  preferenceFit: number;
  irrelevancePenalty: number;
  overexposurePenalty: number;
}

/** Spec §81 — prototype scoring function. */
export function calculateRecommendationScore(f: ScoreFactors): number {
  const score =
    f.needFit * WEIGHTS.needFit +
    f.goalFit * WEIGHTS.goalFit +
    f.behaviourFit * WEIGHTS.behaviourFit +
    f.eligibilityFit * WEIGHTS.eligibilityFit +
    f.timingFit * WEIGHTS.timingFit +
    f.preferenceFit * WEIGHTS.preferenceFit -
    f.irrelevancePenalty -
    f.overexposurePenalty;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export type HardRule =
  | "inactive"
  | "opted_out"
  | "category_fatigue"
  | "customer_declined"
  | "already_held"
  | "segment"
  | "ineligible"
  | "conflict"
  | "snoozed";

export interface EligibilityCheck {
  label: string;
  status: "pass" | "fail" | "unknown";
  detail: string;
}

export interface Eligibility {
  status: "eligible" | "needs_confirmation" | "ineligible";
  checks: EligibilityCheck[];
}

export interface Timing {
  status: "appropriate" | "early" | "neutral" | "not_now";
  reason: string;
}

export interface Explanation {
  goal: string | null;
  behaviour: string;
  pattern: string;
  productFit: string;
  timing: string;
  eligibility: string;
  nextSteps: string[];
  summary: string;
  dataUsed: PermissionKey[];
  estimate?: { label: string; value: string }[];
}

export type Band = "strong" | "potential" | "low" | "excluded";

export interface Evaluation {
  product: Product;
  score: number;
  band: Band;
  factors: ScoreFactors;
  primaryNeed: FinancialNeed | null;
  eligibility: Eligibility;
  timing: Timing;
  exclusion?: { rule: HardRule; reason: string };
  basis: string[];
  usedSignals: Signal[];
  whyNot?: string;
}

export type DecisionStatus = "recommended" | "no_match" | "paused" | "window_cap";

export interface EngineInput {
  customer: CustomerProfile;
  permissions: Permissions;
  goal: FinancialGoal | null;
  preferences: Preferences;
  products: Product[];
  history: RecommendationRecord[];
  now?: Date;
  /** The customer explicitly asked for more options (bypasses frequency caps, not hard rules). */
  requestedMore?: boolean;
}

export interface EngineResult {
  status: DecisionStatus;
  top: Evaluation | null;
  explanation: Explanation | null;
  ranked: Evaluation[];
  context: FinancialContext;
  needs: DetectedNeed[];
  message: string;
  generatedAt: string;
  modelVersion: string;
}

const DAY = 86_400_000;

const SIGNAL_BASIS: Partial<Record<Signal, string>> = {
  regular_surplus: "Your recent savings pattern",
  repeated_saving_behaviour: "Your recent savings pattern",
  consistent_income: "Your income consistency",
  income_increase: "Your recent income increase",
  large_idle_balance: "Your account balance pattern",
  savings_in_everyday_account: "How your savings are held today",
  business_inflows: "Your business inflows",
  business_growth: "Your business growth",
  high_transaction_volume: "Your transaction volume",
  high_card_spend: "How you pay day to day",
  no_emergency_buffer: "Your account balance pattern",
  irregular_income: "Your income pattern",
};

const CATEGORY_LABEL: Record<ProductCategory, string> = {
  savings: "savings",
  investments: "investment",
  financing: "financing",
  business: "business banking",
  cards: "card",
  other: "other financial service",
};

function daysAgo(iso: string, now: Date) {
  return (now.getTime() - new Date(iso).getTime()) / DAY;
}

function isDismissal(f?: FeedbackType) {
  return f === "not_relevant" || f === "dont_want";
}

/** Principal a customer would need to borrow after what they can save before the expense is due. */
export function financingGap(ctx: FinancialContext): number | null {
  if (!ctx.goal || ctx.goal.type !== "major_expense") return null;
  const canSave = (ctx.surplus?.average ?? 0) * ctx.goal.timelineMonths;
  const gap = Math.max(0, ctx.goal.amount - ctx.goal.saved - Math.max(0, canSave));
  return Math.ceil(gap / 50000) * 50000;
}

function checkEligibility(p: Product, ctx: FinancialContext): Eligibility {
  const checks: EligibilityCheck[] = [];
  const e = p.eligibility;
  checks.push({
    label: `Minimum age ${e.minimum_age}`,
    status: ctx.age >= e.minimum_age ? "pass" : "fail",
    detail: ctx.age >= e.minimum_age ? "You meet the age requirement." : `You need to be at least ${e.minimum_age}.`,
  });
  if (e.account_required) {
    checks.push({ label: "Existing account", status: "pass", detail: "You have an active account." });
  }
  if (!p.target_customer.includes(ctx.segment)) {
    checks.push({
      label: "Customer type",
      status: "fail",
      detail:
        ctx.segment === "business"
          ? "This product is designed for personal banking customers."
          : p.target_customer.every((t) => t === "business")
            ? "This product is designed for business customers."
            : "This product isn't designed for your customer type.",
    });
  }
  if (e.minimum_income) {
    if (!ctx.income) {
      checks.push({
        label: `Income of ${formatNaira(e.minimum_income)}+`,
        status: "unknown",
        detail: "We'd need to confirm your income — you haven't shared income patterns.",
      });
    } else {
      const ok = ctx.income.average >= e.minimum_income;
      checks.push({
        label: `Income of ${formatNaira(e.minimum_income)}+`,
        status: ok ? "pass" : "fail",
        detail: ok
          ? "Your average income meets the minimum."
          : `Your average monthly income is below the ${formatNaira(e.minimum_income)} minimum.`,
      });
    }
  }
  if (e.minimum_balance) {
    if (!ctx.activity) {
      checks.push({
        label: `Minimum ${formatNaira(e.minimum_balance)} to place`,
        status: "unknown",
        detail: "We'd need to confirm available funds — you haven't shared account activity.",
      });
    } else {
      const ok = ctx.activity.averageBalance >= e.minimum_balance;
      checks.push({
        label: `Minimum ${formatNaira(e.minimum_balance)} to place`,
        status: ok ? "pass" : "fail",
        detail: ok
          ? "Your typical balance covers the minimum placement."
          : "Your typical balance is below the minimum placement.",
      });
    }
  }
  if (e.max_repayment_to_income) {
    const gap = financingGap(ctx);
    if (!ctx.income || gap === null) {
      checks.push({
        label: "Affordable repayments",
        status: "unknown",
        detail: "We'd need your income and planned expense to estimate affordability.",
      });
    } else {
      const est = loanEstimate(Math.max(gap, 1));
      const ratio = est.monthly / ctx.income.average;
      const ok = ratio <= e.max_repayment_to_income;
      checks.push({
        label: "Affordable repayments",
        status: ok ? "pass" : "fail",
        detail: ok
          ? `Estimated repayment of ${formatNaira(est.monthly)}/month is ${Math.round(ratio * 100)}% of your income (limit ${Math.round(e.max_repayment_to_income * 100)}%).`
          : `Estimated repayment of ${formatNaira(est.monthly)}/month would be ${Math.round(ratio * 100)}% of your income — above the ${Math.round(e.max_repayment_to_income * 100)}% affordability limit.`,
      });
    }
  }
  const status = checks.some((c) => c.status === "fail")
    ? "ineligible"
    : checks.some((c) => c.status === "unknown")
      ? "needs_confirmation"
      : "eligible";
  return { status, checks };
}

function assessTiming(p: Product, ctx: FinancialContext): Timing {
  switch (p.category) {
    case "financing": {
      if (ctx.goal?.type === "major_expense") {
        return ctx.goal.timelineMonths <= 6
          ? {
              status: "appropriate",
              reason: `Your expense is due in ${ctx.goal.timelineMonths} months, so now is the right time to compare financing before the deadline.`,
            }
          : {
              status: "early",
              reason: "Your expense is more than six months away — saving towards it may be enough.",
            };
      }
      return { status: "neutral", reason: "There's no planned expense that makes financing time-sensitive." };
    }
    case "savings": {
      if (hasSignal(ctx, "regular_surplus"))
        return {
          status: "appropriate",
          reason:
            "Your current savings pattern indicates that you have started building surplus funds, making this a relevant time to consider a dedicated savings option.",
        };
      if (hasSignal(ctx, "no_emergency_buffer"))
        return { status: "appropriate", reason: "Building a buffer now protects you before something unexpected happens." };
      return { status: "early", reason: "A consistent surplus would make this more useful." };
    }
    case "investments": {
      const inc = hasSignal(ctx, "income_increase");
      if (inc)
        return {
          status: "appropriate",
          reason: "Your income rose recently and your extra money is accumulating — a good moment to decide where it should go.",
        };
      if (hasSignal(ctx, "large_idle_balance"))
        return { status: "appropriate", reason: "Money has been sitting idle in your everyday account for several months." };
      return { status: "early", reason: "Building a steady surplus first would make this more suitable." };
    }
    case "business":
      if (hasSignal(ctx, "business_growth"))
        return {
          status: "appropriate",
          reason: `Your business inflows have grown about ${Math.round(ctx.activity?.businessGrowthPct ?? 0)}% recently — the point where mixing business and personal money starts to cost you.`,
        };
      return { status: "early", reason: "Your business activity hasn't changed enough to make this urgent." };
    default:
      return { status: "neutral", reason: "There's no time-sensitive trigger for this product." };
  }
}

const TIMING_SCORE: Record<Timing["status"], number> = {
  appropriate: 100,
  neutral: 60,
  early: 40,
  not_now: 0,
};

function goalFitFor(p: Product, ctx: FinancialContext): number {
  const goal = ctx.goal;
  if (!goal) return 30;
  if (goal.type === "not_sure") return 40;
  const map = GOAL_NEEDS[goal.type];
  let fit = 15;
  if (p.financial_needs.some((n) => map.secondary.includes(n))) fit = 60;
  if (p.financial_needs.some((n) => map.primary.includes(n))) fit = 100;
  // Major expense: prefer saving when affordable, financing when not.
  if (goal.type === "major_expense") {
    const plan = goalPlan(goal, ctx.surplus?.average ?? null);
    if (p.financial_needs.includes("expense_financing")) fit = plan.affordableFromSurplus ? 40 : 100;
    else if (p.financial_needs.includes("goal_saving")) fit = plan.affordableFromSurplus ? 100 : 35;
  }
  // Savings goal feasibility: can the contribution be met from surplus?
  if (goal.type === "save_more" && p.financial_needs.includes("goal_saving") && goal.amount > 0) {
    const plan = goalPlan(goal, ctx.surplus?.average ?? null);
    if (plan.shareOfSurplus !== null && plan.shareOfSurplus > 1) {
      fit = Math.round(fit * (0.5 + 0.5 / plan.shareOfSurplus));
    }
  }
  // Holding-period fit: e.g. a 24-month goal suits a longer-term product.
  const h = p.horizon_months;
  if (h && goal.timelineMonths && fit >= 60) {
    if ((h.min && goal.timelineMonths < h.min) || (h.max && goal.timelineMonths > h.max)) {
      fit = Math.round(fit * 0.7);
    }
  }
  return fit;
}

function evaluateProduct(
  p: Product,
  ctx: FinancialContext,
  needs: DetectedNeed[],
  prefs: Preferences,
  history: RecommendationRecord[],
  now: Date,
): Evaluation {
  const eligibility = checkEligibility(p, ctx);
  let timing = assessTiming(p, ctx);

  const productNeeds = needs.filter((n) => p.financial_needs.includes(n.need));
  const primary = productNeeds[0] ?? null;
  const needFit = primary?.strength ?? 0;
  const goalFit = goalFitFor(p, ctx);

  const present = p.recommended_when
    .map((s) => hasSignal(ctx, s))
    .filter((s): s is NonNullable<typeof s> => Boolean(s));
  const behaviourFit = p.recommended_when.length
    ? (present.reduce((a, s) => a + s.strength, 0) / p.recommended_when.length) * 100
    : 0;

  const eligibilityFit =
    eligibility.status === "eligible" ? 100 : eligibility.status === "needs_confirmation" ? 60 : 0;

  const productHistory = history.filter((h) => h.productId === p.product_id);
  const recentDismissal = productHistory.find(
    (h) => h.feedback === "not_relevant" && h.feedbackAt && daysAgo(h.feedbackAt, now) < FATIGUE_WINDOW_DAYS,
  );
  if (recentDismissal) {
    timing = { status: "not_now", reason: "You recently told us this wasn't relevant." };
  }

  const categoryDismissals = history.filter(
    (h) =>
      h.category === p.category &&
      isDismissal(h.feedback) &&
      h.feedbackAt &&
      daysAgo(h.feedbackAt, now) < FATIGUE_WINDOW_DAYS,
  ).length;
  const preferenceFit = categoryDismissals > 0 ? 50 : 100;

  const conflicts = p.not_recommended_when.filter((s) => hasSignal(ctx, s));
  const irrelevancePenalty =
    conflicts.filter((s) => s !== "needs_immediate_liquidity").length * 25 + (needFit === 0 ? 40 : 0);
  const recentExposures = productHistory.filter(
    (h) => daysAgo(h.createdAt, now) < DECISION_WINDOW_DAYS && h.status === "recommended",
  ).length;
  const overexposurePenalty = recentExposures >= 2 ? 10 : 0;

  const factors: ScoreFactors = {
    needFit: Math.round(needFit),
    goalFit: Math.round(goalFit),
    behaviourFit: Math.round(behaviourFit),
    eligibilityFit,
    timingFit: TIMING_SCORE[timing.status],
    preferenceFit,
    irrelevancePenalty,
    overexposurePenalty,
  };
  const score = calculateRecommendationScore(factors);

  // Hard rules: cannot be recommended regardless of score.
  let exclusion: Evaluation["exclusion"];
  const held = p.equivalent_holding && ctx.holdings?.includes(p.equivalent_holding);
  const snoozed = productHistory.find(
    (h) => h.snoozedUntil && new Date(h.snoozedUntil).getTime() > now.getTime(),
  );
  if (p.status !== "active") {
    exclusion = { rule: "inactive", reason: "This product isn't currently available." };
  } else if (!prefs.categories[p.category]) {
    exclusion = {
      rule: "opted_out",
      reason: `You asked MoneyMap not to recommend ${CATEGORY_LABEL[p.category]} products.`,
    };
  } else if (productHistory.some((h) => h.feedback === "dont_want")) {
    exclusion = { rule: "customer_declined", reason: "You told us you don't want this product." };
  } else if (recentDismissal) {
    exclusion = { rule: "customer_declined", reason: "You recently told us this wasn't relevant." };
  } else if (categoryDismissals >= CATEGORY_FATIGUE_LIMIT) {
    exclusion = {
      rule: "category_fatigue",
      reason: `You've dismissed several ${CATEGORY_LABEL[p.category]} suggestions recently, so we've paused them.`,
    };
  } else if (held) {
    exclusion = { rule: "already_held", reason: "You already have this product or an equivalent one." };
  } else if (!p.target_customer.includes(ctx.segment)) {
    exclusion = {
      rule: "segment",
      reason: eligibility.checks.find((c) => c.label === "Customer type")?.detail ?? "Not designed for your customer type.",
    };
  } else if (eligibility.status === "ineligible") {
    const failed = eligibility.checks.find((c) => c.status === "fail");
    exclusion = {
      rule: "ineligible",
      reason: `Your current eligibility does not meet the product's requirements. ${failed?.detail ?? ""}`.trim(),
    };
  } else if (conflicts.includes("needs_immediate_liquidity")) {
    exclusion = {
      rule: "conflict",
      reason: "You'll need this money soon, and this product works best when money stays put.",
    };
  } else if (snoozed) {
    exclusion = { rule: "snoozed", reason: "You asked us to remind you later." };
  }

  const band: Band = exclusion
    ? "excluded"
    : score >= THRESHOLDS.strong
      ? "strong"
      : score >= THRESHOLDS.potential
        ? "potential"
        : "low";

  const basis: string[] = [];
  if (ctx.goal && goalFit >= 60) basis.push("Your stated goal");
  for (const s of present) {
    const label = SIGNAL_BASIS[s.signal];
    if (label && !basis.includes(label)) basis.push(label);
  }
  if (ctx.goal && goalFit >= 60 && ctx.goal.timelineMonths) basis.push("Your preferred timeline");
  if (eligibility.status === "eligible") basis.push("Current eligibility");
  else if (eligibility.status === "needs_confirmation") basis.push("Eligibility (to be confirmed)");

  return {
    product: p,
    score: exclusion ? 0 : score,
    band,
    factors,
    primaryNeed: primary?.need ?? null,
    eligibility,
    timing,
    exclusion,
    basis,
    usedSignals: present.map((s) => s.signal),
  };
}

function whyNot(e: Evaluation, top: Evaluation | null, goalMonths: number | null): string {
  if (e.exclusion) return e.exclusion.reason;
  if (e.factors.needFit === 0) return "Your current situation doesn't show a need this product is designed for.";
  if (top && e.factors.goalFit < top.factors.goalFit) {
    const h = e.product.horizon_months;
    const months = goalMonths ?? 0;
    if (h?.max && months > h.max)
      return `It suits money you'll need within ${h.max} months — your goal has a longer timeline.`;
    if (h?.min && months && months < h.min)
      return `It suits money you can leave for ${h.min}+ months — your goal has a shorter timeline.`;
    return "It does not currently align as closely with your stated goal.";
  }
  if (e.factors.irrelevancePenalty > 0)
    return "Parts of your current financial pattern suggest it may not suit you right now.";
  if (e.timing.status === "early" || e.timing.status === "not_now") return e.timing.reason;
  if (e.factors.behaviourFit < 50) return "Your recent financial behaviour doesn't strongly indicate this need yet.";
  return top
    ? `It's a reasonable option, but scored lower than ${top.product.name} for your situation.`
    : "It isn't a strong enough match for your situation right now.";
}

function explain(top: Evaluation, ctx: FinancialContext): Explanation {
  const p = top.product;
  const ev = (s: Signal) => hasSignal(ctx, s)?.evidence;
  const goal = ctx.goal;
  const dataUsed = new Set<PermissionKey>();
  for (const s of ctx.signals) if (top.usedSignals.includes(s.signal)) dataUsed.add(s.source);
  if (goal) dataUsed.add("financial_goals");

  const goalText = goal
    ? goal.amount > 0
      ? goal.label.includes(formatNaira(goal.amount))
        ? `${goal.label} in ${goal.timelineMonths} months.`
        : `${goal.label} — ${formatNaira(goal.amount)} in ${goal.timelineMonths} months.`
      : `${goal.label}.`
    : null;

  const behaviour =
    ev("consistent_income") ??
    ev("income_increase") ??
    ev("business_growth") ??
    (ctx.income
      ? `Your average monthly income is about ${formatNaira(ctx.income.average)}.`
      : "You haven't shared income patterns, so we relied on other information.");

  const pattern =
    ev("savings_in_everyday_account") && ev("regular_surplus")
      ? `${ev("regular_surplus")} You regularly retain surplus funds after recurring expenses.`
      : (ev("large_idle_balance") ??
        ev("regular_surplus") ??
        ev("high_transaction_volume") ??
        ev("business_inflows") ??
        ev("planned_major_expense") ??
        "We didn't see a strong pattern beyond what you told us.");

  const productFit = top.primaryNeed
    ? `${p.name} is designed for ${p.purpose.toLowerCase()} — and ${NEED_LABELS[top.primaryNeed].toLowerCase()} is what your situation points to.`
    : `${p.name} is designed for ${p.purpose.toLowerCase()}.`;

  const eligibilityText =
    top.eligibility.status === "eligible"
      ? "Based on the information you've permitted, you meet the current eligibility requirements. Final approval follows the bank's formal checks."
      : "Some eligibility requirements still need to be confirmed before you can proceed.";

  const nextSteps =
    p.category === "financing"
      ? ["Review the product and terms", "Confirm eligibility", "Submit an application for credit assessment", "Get a decision from the bank"]
      : p.application_route === "relationship_manager"
        ? ["Review the product", "Confirm eligibility", "Speak with a relationship manager", "Start working toward your goal"]
        : ["Review the product", "Confirm eligibility", "Apply / open / activate", "Start working toward your goal"];

  let estimate: Explanation["estimate"];
  let summary = `${productFit} ${top.timing.reason}`;
  if (goal && goal.amount > 0 && p.financial_needs.includes("goal_saving")) {
    const plan = goalPlan(goal, ctx.surplus?.average ?? null);
    estimate = [
      { label: "Target", value: formatNaira(plan.target) },
      { label: "Timeline", value: `${plan.timelineMonths} months` },
      { label: "Suggested monthly contribution", value: formatNaira(plan.monthlyContribution) },
    ];
    if (plan.shareOfSurplus !== null)
      estimate.push({ label: "Share of your average surplus", value: `${Math.round(plan.shareOfSurplus * 100)}%` });
    summary = `You told us you want to save ${formatNaira(goal.amount)} within ${goal.timelineMonths} months. ${
      ctx.surplus ? "Your recent income and spending pattern suggests you may be able to set money aside consistently. " : ""
    }This product is designed to help separate goal-focused funds from everyday spending.`;
  } else if (p.category === "financing") {
    const gap = financingGap(ctx);
    if (gap) {
      const est = loanEstimate(gap);
      estimate = [
        { label: "Planned expense", value: formatNaira(goal!.amount) },
        { label: "You could save before it's due", value: formatNaira(Math.max(0, goal!.amount - gap)) },
        { label: "Estimated amount to finance", value: formatNaira(gap) },
        { label: "Illustrative monthly repayment (12 months)", value: formatNaira(est.monthly) },
      ];
      summary = `You're planning to spend ${formatNaira(goal!.amount)} in ${goal!.timelineMonths} months. At your current surplus you could set aside part of it, leaving a gap of about ${formatNaira(gap)}. A planned loan for the gap can be easier to manage than a last-minute shortfall — subject to the bank's credit assessment.`;
    }
  } else if (ctx.surplus && (p.category === "investments" || p.category === "business")) {
    summary = `${behaviour} ${pattern} ${productFit}`;
  }

  return {
    goal: goalText,
    behaviour,
    pattern,
    productFit,
    timing: top.timing.reason,
    eligibility: eligibilityText,
    nextSteps,
    summary,
    dataUsed: [...dataUsed],
    estimate,
  };
}

export function runEngine(input: EngineInput): EngineResult {
  const now = input.now ?? new Date();
  const context = buildFinancialContext(input.customer, input.permissions, input.goal);
  const needs = detectNeeds(context);
  const evaluations = input.products.map((p) =>
    evaluateProduct(p, context, needs, input.preferences, input.history, now),
  );
  const ranked = [...evaluations].sort(
    (a, b) => Number(Boolean(a.exclusion)) - Number(Boolean(b.exclusion)) || b.score - a.score,
  );
  const candidate = ranked.find((e) => !e.exclusion) ?? null;

  const base = {
    context,
    needs,
    generatedAt: now.toISOString(),
    modelVersion: MODEL_VERSION,
  };
  const finish = (
    status: DecisionStatus,
    top: Evaluation | null,
    message: string,
  ): EngineResult => {
    for (const e of ranked) if (e !== top) e.whyNot = whyNot(e, top, context.goal?.timelineMonths ?? null);
    return {
      ...base,
      status,
      top,
      explanation: top ? explain(top, context) : null,
      ranked,
      message,
    };
  };

  // Over-marketing control: global fatigue.
  const recentDismissals = input.history.filter(
    (h) => isDismissal(h.feedback) && h.feedbackAt && daysAgo(h.feedbackAt, now) < FATIGUE_WINDOW_DAYS,
  );
  if (!input.requestedMore && recentDismissals.length >= FATIGUE_LIMIT) {
    return finish(
      "paused",
      null,
      "You've dismissed several recommendations recently, so MoneyMap has paused suggestions. We'll only show something if you ask.",
    );
  }

  if (!candidate || candidate.band === "low") {
    return finish(
      "no_match",
      null,
      context.coverage < 0.4
        ? "We couldn't identify a strong match with the information you've shared. Sharing more context may help — but it's always your choice."
        : "Your current financial activity does not indicate a strong need for any of the products available to you right now.",
    );
  }

  // Decision window: max one proactive recommendation per window.
  const lastDismissedInWindow = input.history.find(
    (h) =>
      isDismissal(h.feedback) &&
      h.productId !== candidate.product.product_id &&
      daysAgo(h.createdAt, now) < DECISION_WINDOW_DAYS,
  );
  if (!input.requestedMore && lastDismissedInWindow) {
    return finish(
      "window_cap",
      null,
      `You've already seen a recommendation this week. To avoid over-marketing, MoneyMap shows at most one proactive recommendation every ${DECISION_WINDOW_DAYS} days unless you ask for more.`,
    );
  }

  if (candidate.band === "potential" && !input.requestedMore && input.preferences.frequency === "highly_relevant") {
    return finish(
      "no_match",
      null,
      "We found a possible option, but it isn't a strong enough match to show under your “only when highly relevant” setting.",
    );
  }

  return finish("recommended", candidate, "");
}

/** Shape the result as the spec §37 REST response. */
export function toApiResponse(result: EngineResult, recommendationId: string) {
  return {
    recommendation_id: recommendationId,
    status: result.status === "recommended" ? "recommended" : result.status,
    model_version: result.modelVersion,
    product: result.top
      ? { id: result.top.product.product_id, name: result.top.product.name }
      : null,
    score: result.top?.score ?? null,
    factors: result.top?.factors ?? null,
    reasons: result.top?.basis ?? [],
    timing: result.top
      ? { status: result.top.timing.status, reason: result.top.timing.reason }
      : null,
    actions: result.top ? ["view_product", "apply", "dismiss"] : ["view_map", "explore_products"],
    message: result.message || undefined,
  };
}

export { buildFinancialContext, detectNeeds, goalPlan, loanEstimate, NEED_LABELS, clamp };
export type { FinancialContext, DetectedNeed };
