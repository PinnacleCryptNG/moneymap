// Stages 3–5 — MATCH, DECIDE, EXPLAIN.
// Transparent rules + weighted scoring. Weights and thresholds are prototype values that must be
// validated with approved data and controlled testing before production.
import type {
  CustomerProfile,
  EligibilityStatus,
  FeedbackType,
  FinancialGoal,
  FinancialNeed,
  Permissions,
  Preferences,
  Product,
  ProductCategory,
  RecommendationRecord,
  Signal,
  SelfReport,
  Trigger,
} from "../types";
import { SUBJECT_TO_ZENITH } from "../data/products";
import { clamp, formatNaira } from "../utils/format";
import { buildFinancialContext, type FinancialContext, hasSignal, type SignalSource } from "./context";
import { detectNeeds, type DetectedNeed, GOAL_NEEDS, isAssetGoal, NEED_LABELS } from "./needs";
import { EXAMPLE_TENOR_MONTHS, goalPlan, principalSpread } from "./plan";
import { applySelfReport } from "./selfReport";
import { triggerTimingReason } from "./triggers";

export const MODEL_VERSION = "rules-v2.0-prototype";

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
export const REMIND_LATER_DAYS = 3;

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

/** PRD §81 — prototype scoring function. */
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
  | "ineligible"
  | "unsuitable"
  | "conflict"
  | "snoozed";

export interface EligibilityCheck {
  label: string;
  status: "pass" | "fail" | "unknown";
  detail: string;
  /** "published": a condition from a public Zenith source. "guardrail": MoneyMap's own prototype rule. */
  basis: "published" | "guardrail";
  source?: string;
}

export interface Eligibility {
  status: EligibilityStatus;
  checks: EligibilityCheck[];
  note: string;
}

export interface Timing {
  status: "appropriate" | "early" | "neutral" | "not_now";
  reason: string;
}

export interface Influence {
  key: "goal" | "behaviour" | "relationship" | "purpose";
  label: string;
  detail: string;
}

export interface Explanation {
  whyItFits: string;
  whyNow: string;
  influences: Influence[];
  goal: string | null;
  context: string[];
  productFit: string;
  timing: string;
  eligibility: string;
  nextSteps: string[];
  dataUsed: SignalSource[];
  estimate?: { label: string; value: string }[];
  estimateNote?: string;
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
  usedSignals: Signal[];
  whyNot?: string;
}

export type DecisionStatus = "recommended" | "no_match" | "paused" | "window_cap";

export interface TraceStep {
  stage: string;
  result: string;
  status: "done" | "empty" | "stop";
}

export interface EngineInput {
  customer: CustomerProfile;
  permissions: Permissions;
  goal: FinancialGoal | null;
  preferences: Preferences;
  products: Product[];
  history: RecommendationRecord[];
  now?: Date;
  /** An account event that prompted this run (step 3), e.g. salary landing. Only affects timing. */
  trigger?: Trigger | null;
  /** The customer's own answers about their money; fill in what the statement doesn't show. */
  selfReport?: SelfReport | null;
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
  trace: TraceStep[];
  message: string;
  generatedAt: string;
  modelVersion: string;
}

const DAY = 86_400_000;

export const CATEGORY_LABEL: Record<ProductCategory, string> = {
  savings: "savings",
  accounts: "account",
  financing: "financing",
  cards: "card",
};

const BEHAVIOUR_SIGNALS: Signal[] = [
  "consistent_income",
  "irregular_income",
  "income_increase",
  "salary_account",
  "allowance_income",
  "regular_surplus",
  "low_surplus",
  "repeated_saving_behaviour",
  "student_activity",
  "digital_first",
  "high_card_spend",
  "no_emergency_buffer",
  "large_idle_balance",
];

function daysAgo(iso: string, now: Date) {
  return (now.getTime() - new Date(iso).getTime()) / DAY;
}

export function isDismissal(f?: FeedbackType) {
  return f === "not_relevant" || f === "not_wanted";
}

/** Amount a customer would need to finance after what they can save before the expense is due. */
export function financingGap(ctx: FinancialContext): number | null {
  if (!ctx.goal || ctx.goal.type !== "major_expense") return null;
  const canSave = (ctx.surplus?.average ?? 0) * ctx.goal.timelineMonths;
  const gap = Math.max(0, ctx.goal.amount - ctx.goal.saved - Math.max(0, canSave));
  return Math.ceil(gap / 50000) * 50000;
}

function checkEligibility(p: Product, ctx: FinancialContext): Eligibility {
  const checks: EligibilityCheck[] = [];
  const e = p.eligibility;
  if (e.segments) {
    const ok = e.segments.includes(ctx.segment);
    checks.push({
      label: `For ${e.segments.join(" / ")} customers`,
      status: ok ? "pass" : "fail",
      detail: ok ? "Your profile matches who this product is published for." : `It's published as a product for ${e.segments.join(" / ")} customers.`,
      basis: "published",
      source: e.source,
    });
  }
  if (e.minimum_age !== undefined || e.maximum_age !== undefined) {
    const min = e.minimum_age ?? 0;
    const max = e.maximum_age ?? 200;
    const ok = ctx.age >= min && ctx.age <= max;
    const range = e.maximum_age !== undefined ? `${min}–${max}` : `${min}+`;
    checks.push({
      label: `Age ${range}`,
      status: ok ? "pass" : "fail",
      detail: ok ? `At ${ctx.age}, you're within the reported age range.` : `The reported age range is ${range}.`,
      basis: "published",
      source: e.source,
    });
  }
  if (e.salary_account_required) {
    const known = ctx.income !== null;
    const ok = ctx.income?.source === "salary";
    checks.push({
      label: "Salary paid into Zenith",
      status: !known ? "unknown" : ok ? "pass" : "fail",
      detail: !known
        ? "We'd need to confirm where your income comes from — you haven't shared income patterns."
        : ok
          ? "Your salary is paid into your Zenith account."
          : "It's reported to require a Zenith account that receives your salary.",
      basis: "published",
      source: e.source,
    });
  }

  // MoneyMap guardrails (prototype suitability rules, not Zenith eligibility).
  const s = p.suitability;
  if (s.max_principal_to_income) {
    const gap = financingGap(ctx);
    if (!ctx.income || gap === null) {
      checks.push({
        label: "Affordable repayments",
        status: "unknown",
        detail: "We'd need your income and a planned expense to check affordability.",
        basis: "guardrail",
      });
    } else {
      const spread = principalSpread(Math.max(gap, 1));
      const ratio = spread.monthly / ctx.income.average;
      const ok = ratio <= s.max_principal_to_income;
      checks.push({
        label: "Affordable repayments",
        status: ok ? "pass" : "fail",
        detail: ok
          ? `Repaying ${formatNaira(gap)} over ${EXAMPLE_TENOR_MONTHS} months is about ${formatNaira(spread.monthly)} a month before interest — ${Math.round(ratio * 100)}% of your income (MoneyMap's limit: ${Math.round(s.max_principal_to_income * 100)}%).`
          : `Repaying ${formatNaira(gap)} over ${EXAMPLE_TENOR_MONTHS} months would be about ${formatNaira(spread.monthly)} a month before interest — ${Math.round(ratio * 100)}% of your income, above MoneyMap's ${Math.round(s.max_principal_to_income * 100)}% limit.`,
        basis: "guardrail",
      });
    }
  }
  if (s.max_balance && ctx.goal && ctx.goal.amount > s.max_balance && ctx.goal.type === "save_more") {
    checks.push({
      label: "Balance cap fits your goal",
      status: "fail",
      detail: `Its reported balance cap (${formatNaira(s.max_balance)}) is below your ${formatNaira(ctx.goal.amount)} goal.`,
      basis: "guardrail",
    });
  }

  const status: EligibilityStatus = checks.some((c) => c.status === "fail")
    ? "ineligible"
    : checks.some((c) => c.status === "unknown")
      ? "to_confirm"
      : "eligible";
  const note =
    checks.filter((c) => c.basis === "published").length === 0
      ? `No published conditions were found for this product. ${SUBJECT_TO_ZENITH}`
      : SUBJECT_TO_ZENITH;
  return { status, checks, note };
}

function assessTiming(p: Product, ctx: FinancialContext): Timing {
  switch (p.category) {
    case "financing": {
      if (ctx.goal?.type === "major_expense" && ctx.goal.amount > 0) {
        return ctx.goal.timelineMonths <= 12
          ? {
              status: "appropriate",
              reason: `You need the money within ${ctx.goal.timelineMonths} months — early enough to plan properly, instead of scrambling at the deadline.`,
            }
          : { status: "early", reason: "Your expense is more than a year away — saving towards it may be enough." };
      }
      return { status: "neutral", reason: "There's no planned expense that makes financing relevant now." };
    }
    case "savings": {
      if (ctx.trigger && (hasSignal(ctx, "regular_surplus") || ctx.goal?.type === "save_more"))
        return { status: "appropriate", reason: triggerTimingReason(ctx.trigger) };
      if (ctx.goal?.type === "save_more" && hasSignal(ctx, "regular_surplus"))
        return {
          status: "appropriate",
          reason: "Your recent financial pattern suggests that setting aside part of your monthly surplus now could support the goal you stated.",
        };
      if (hasSignal(ctx, "regular_surplus"))
        return { status: "appropriate", reason: "You've started building a surplus — a good moment to give it somewhere to go." };
      if (hasSignal(ctx, "no_emergency_buffer"))
        return { status: "appropriate", reason: "Starting a small buffer now protects you before something unexpected happens." };
      return { status: "early", reason: "A steadier surplus would make this more useful." };
    }
    case "accounts":
      if (hasSignal(ctx, "student_activity"))
        return {
          status: "appropriate",
          reason: "You're in school now and use your account every day for campus life — the account you bank with should fit this stage.",
        };
      return { status: "early", reason: "Nothing in your activity suggests this account fits your stage right now." };
    default:
      return { status: "neutral", reason: "There's no time-sensitive reason to consider this now." };
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
  if (goal.type === "major_expense") {
    const plan = goalPlan(goal, ctx.surplus?.average ?? null);
    const financingNeed: FinancialNeed = isAssetGoal(goal) ? "asset_financing" : "expense_financing";
    if (p.financial_needs.includes("expense_financing") || p.financial_needs.includes("asset_financing")) {
      fit = !p.financial_needs.includes(financingNeed) ? 30 : plan.affordableFromSurplus ? 40 : 100;
    } else if (p.financial_needs.includes("goal_saving")) {
      fit = plan.affordableFromSurplus ? 100 : 35;
    }
  }
  if (goal.type === "everyday" && p.financial_needs.includes("student_banking") && ctx.segment !== "student") fit = 30;
  // Savings goal feasibility: can the contribution be met from surplus?
  if (goal.type === "save_more" && p.financial_needs.includes("goal_saving") && goal.amount > 0) {
    const plan = goalPlan(goal, ctx.surplus?.average ?? null);
    if (plan.shareOfSurplus !== null && plan.shareOfSurplus > 1) {
      fit = Math.round(fit * (0.5 + 0.5 / plan.shareOfSurplus));
    }
  }
  return fit;
}

function wantsNewSavingsGoal(ctx: FinancialContext) {
  const g = ctx.goal;
  if (!g || g.amount <= 0) return false;
  if (g.type === "save_more") return true;
  if (g.type === "major_expense") return goalPlan(g, ctx.surplus?.average ?? null).affordableFromSurplus === true;
  return false;
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

  const eligibilityFit = eligibility.status === "eligible" ? 100 : eligibility.status === "to_confirm" ? 60 : 0;

  const productHistory = history.filter((h) => h.product_id === p.product_id);
  const recentDismissal = productHistory.find(
    (h) => h.feedback === "not_relevant" && h.feedback_at && daysAgo(h.feedback_at, now) < FATIGUE_WINDOW_DAYS,
  );
  if (recentDismissal) timing = { status: "not_now", reason: "You recently told us this wasn't relevant." };

  const categoryDismissals = history.filter(
    (h) => h.category === p.category && isDismissal(h.feedback) && h.feedback_at && daysAgo(h.feedback_at, now) < FATIGUE_WINDOW_DAYS,
  ).length;
  const preferenceFit = categoryDismissals > 0 ? 50 : 100;

  const conflicts = p.not_recommended_when.filter((s) => hasSignal(ctx, s));
  const irrelevancePenalty =
    conflicts.filter((s) => s !== "needs_immediate_liquidity").length * 25 + (needFit === 0 ? 40 : 0);
  const recentExposures = productHistory.filter(
    (h) => daysAgo(h.created_at, now) < DECISION_WINDOW_DAYS && h.status === "recommended",
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
  const held = Boolean(p.equivalent_holding && ctx.holdings?.includes(p.equivalent_holding));
  const heldButNewGoal = held && p.multiple_allowed && wantsNewSavingsGoal(ctx);
  const snoozed = productHistory.find((h) => h.snoozed_until && new Date(h.snoozed_until).getTime() > now.getTime());
  const failed = eligibility.checks.find((c) => c.status === "fail");
  if (p.status !== "active") {
    exclusion = { rule: "inactive", reason: "This product isn't currently available." };
  } else if (!prefs.categories[p.category]) {
    exclusion = { rule: "opted_out", reason: `You asked MoneyMap not to suggest ${CATEGORY_LABEL[p.category]} products.` };
  } else if (productHistory.some((h) => h.status === "applied")) {
    exclusion = { rule: "already_held", reason: `You've already asked to open ${p.name}. Zenith will take it from here.` };
  } else if (productHistory.some((h) => h.feedback === "not_wanted")) {
    exclusion = { rule: "customer_declined", reason: "You told us you don't want this product." };
  } else if (recentDismissal) {
    exclusion = { rule: "customer_declined", reason: "You recently told us this wasn't relevant, so we won't show it again for now." };
  } else if (categoryDismissals >= CATEGORY_FATIGUE_LIMIT) {
    exclusion = {
      rule: "category_fatigue",
      reason: `You've dismissed several ${CATEGORY_LABEL[p.category]} suggestions recently, so we've paused them.`,
    };
  } else if (held && !heldButNewGoal) {
    exclusion = {
      rule: "already_held",
      reason: p.multiple_allowed
        ? `You already have ${p.name} working for you. Set a new savings goal if you want a separate one for it.`
        : `You already have this product (${p.name}), so another one wouldn't add anything.`,
    };
  } else if (failed && failed.basis === "published") {
    exclusion = { rule: "ineligible", reason: `Your current eligibility does not meet the product's published requirements. ${failed.detail}` };
  } else if (failed) {
    exclusion = { rule: "unsuitable", reason: failed.detail };
  } else if (conflicts.includes("needs_immediate_liquidity")) {
    exclusion = { rule: "conflict", reason: "You'll need this money soon, and this product works best when money stays put." };
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

  return {
    product: p,
    score: exclusion ? 0 : score,
    band,
    factors,
    primaryNeed: primary?.need ?? null,
    eligibility,
    timing,
    exclusion,
    usedSignals: present.map((s) => s.signal),
  };
}

function whyNot(e: Evaluation, top: Evaluation | null): string {
  if (e.exclusion) return e.exclusion.reason;
  if (e.factors.needFit === 0) return "Your current situation doesn't show the need this product is designed for.";
  if (top && e.factors.goalFit < top.factors.goalFit) return "It does not currently align as closely with your stated goal.";
  if (e.factors.irrelevancePenalty > 0) return "Parts of your current financial pattern suggest it may not suit you right now.";
  if (e.timing.status === "early" || e.timing.status === "not_now") return e.timing.reason;
  if (e.factors.behaviourFit < 50) return "Your recent financial behaviour doesn't strongly point to this need yet.";
  return top
    ? `It's a reasonable option, but scored lower than ${top.product.name} for your situation.`
    : "It isn't a strong enough match for your situation right now.";
}

function contextLines(ctx: FinancialContext, used: Signal[]): string[] {
  const lines: string[] = [];
  for (const s of ctx.signals) if (used.includes(s.signal) && BEHAVIOUR_SIGNALS.includes(s.signal)) lines.push(s.evidence);
  if (lines.length === 0 && ctx.income) lines.push(`Your average monthly income is about ${formatNaira(ctx.income.average)}.`);
  if (lines.length === 0) lines.push("You haven't shared financial activity, so MoneyMap relied on your goal.");
  return lines;
}

function explain(top: Evaluation, ctx: FinancialContext): Explanation {
  const p = top.product;
  const goal = ctx.goal;
  const dataUsed = new Set<SignalSource>();
  for (const s of ctx.signals) if (top.usedSignals.includes(s.signal)) dataUsed.add(s.source);
  if (goal && top.factors.goalFit >= 60) dataUsed.add("financial_goals");
  if (ctx.holdings) dataUsed.add("existing_products");

  const goalText = goal
    ? goal.amount > 0
      ? goal.label.includes(formatNaira(goal.amount))
        ? `${goal.label} in ${goal.timelineMonths} months.`
        : `${goal.label} — ${formatNaira(goal.amount)} within ${goal.timelineMonths} months.`
      : `${goal.label}.`
    : null;

  const context = contextLines(ctx, top.usedSignals);
  const need = top.primaryNeed ? NEED_LABELS[top.primaryNeed].toLowerCase() : null;
  const productFit = need
    ? `${p.name} is built for ${p.purpose.toLowerCase()} — and ${need} is what your situation points to.`
    : `${p.name} is built for ${p.purpose.toLowerCase()}.`;

  // Why it fits — one plain sentence joining the goal and the strongest pattern.
  const has = (s: Signal) => top.usedSignals.includes(s);
  let whyItFits = productFit;
  if (p.financial_needs.includes("goal_saving") && goal?.type === "save_more" && has("regular_surplus"))
    whyItFits = `You have a defined savings goal and a recurring monthly surplus${
      has("savings_in_everyday_account") ? " — but the money you keep sits in your everyday account" : ""
    }. ${p.name} keeps goal money separate from spending money.`;
  else if (p.financial_needs.includes("student_banking"))
    whyItFits = "You're a student who banks almost entirely by card and app, living on a monthly allowance — and Aspire is Zenith's account built for students.";
  else if (p.category === "financing" && goal)
    whyItFits = `You're planning ${goal.label.toLowerCase()}, your income is steady, and your surplus alone won't cover it in time.`;

  const relationship = ctx.holdings
    ? ctx.holdings.includes(p.equivalent_holding as never)
      ? `You already hold ${p.name}; this would be a separate one for your new goal.`
      : `You don't currently hold ${p.name}${hasSignal(ctx, "has_dedicated_savings") && p.category === "savings" ? "" : " or anything that does the same job"}.`
    : "You haven't shared your existing products, so we couldn't check for overlap.";

  const influences: Influence[] = [];
  if (goal && top.factors.goalFit >= 60) influences.push({ key: "goal", label: "Your goal", detail: goalText ?? goal.label });
  if (top.usedSignals.some((s) => BEHAVIOUR_SIGNALS.includes(s)))
    influences.push({ key: "behaviour", label: "Permitted financial behaviour", detail: context[0] });
  influences.push({ key: "relationship", label: "Your current banking relationship", detail: relationship });
  influences.push({ key: "purpose", label: "Product purpose", detail: `${p.name}: ${p.purpose}.` });

  const eligibilityText =
    top.eligibility.status === "eligible"
      ? `Nothing in the published conditions or MoneyMap's checks rules you out. ${top.eligibility.note}`
      : `Some conditions still need to be confirmed. ${top.eligibility.note}`;

  const nextSteps =
    p.category === "financing"
      ? ["Review the product", "Confirm your details with Zenith", "Submit a request for credit assessment", "Zenith decides — MoneyMap never approves credit"]
      : ["Review the product", "Confirm your details", "Open it on the Zenith app or at a branch", "Start using it for your goal"];

  let estimate: Explanation["estimate"];
  let estimateNote: string | undefined;
  if (goal && goal.amount > 0 && p.financial_needs.includes("goal_saving")) {
    const plan = goalPlan(goal, ctx.surplus?.average ?? null);
    estimate = [
      { label: "Target", value: formatNaira(plan.target) },
      { label: "Timeline", value: `${plan.timelineMonths} months` },
      { label: "Suggested monthly saving", value: formatNaira(plan.monthlyContribution) },
    ];
    if (plan.shareOfSurplus !== null) estimate.push({ label: "Share of your monthly surplus", value: `${Math.round(plan.shareOfSurplus * 100)}%` });
    estimateNote = "Simple division of your target over your timeline. Interest is not included because rates are set by Zenith.";
  } else if (p.category === "financing" && goal) {
    const gap = financingGap(ctx);
    if (gap) {
      const spread = principalSpread(gap);
      estimate = [
        { label: "Planned expense", value: formatNaira(goal.amount) },
        { label: "You could save before it's due", value: formatNaira(Math.max(0, goal.amount - gap)) },
        { label: "Amount to finance", value: formatNaira(gap) },
        { label: `Principal over ${EXAMPLE_TENOR_MONTHS} months`, value: `${formatNaira(spread.monthly)}/month` },
      ];
      estimateNote = "Principal only, over an example 12-month period. Interest, charges, tenor and approval are set by Zenith's credit assessment.";
    }
  }

  return {
    whyItFits,
    whyNow: top.timing.reason,
    influences,
    goal: goalText,
    context,
    productFit,
    timing: top.timing.reason,
    eligibility: eligibilityText,
    nextSteps,
    dataUsed: [...dataUsed],
    estimate,
    estimateNote,
  };
}

function buildTrace(
  input: EngineInput,
  ctx: FinancialContext,
  needs: DetectedNeed[],
  ranked: Evaluation[],
  status: DecisionStatus,
  top: Evaluation | null,
): TraceStep[] {
  const c = input.customer;
  const permitted = Object.values(input.permissions).filter(Boolean).length;
  const addressing = ranked.filter((e) => e.factors.needFit > 0);
  const passed = addressing.filter((e) => !e.exclusion);
  const ctxParts = [
    ctx.income && `${formatNaira(ctx.income.average)} in`,
    ctx.spending && `${formatNaira(ctx.spending.average)} out`,
    ctx.surplus && `${formatNaira(ctx.surplus.average)} left over`,
  ].filter(Boolean);
  return [
    { stage: "Customer", result: `${c.firstName}, ${c.age} · ${c.occupation}`, status: "done" },
    ...(ctx.trigger
      ? [{ stage: "Trigger", result: `${ctx.trigger.description}: ${formatNaira(ctx.trigger.amount)} arrived — MoneyMap took a fresh look`, status: "done" as const }]
      : []),
    { stage: "Permitted data", result: `${permitted} of 5 categories allowed`, status: permitted ? "done" : "empty" },
    {
      stage: "Financial context",
      result: `${ctxParts.length ? `${ctxParts.join(" · ")} a month · ` : ""}${ctx.signals.length} signals${
        ctx.ledger && (ctx.ledger.income || ctx.ledger.spending || ctx.ledger.activity) ? ` from ${ctx.ledger.transactionCount} transactions` : ""
      }${c.reported && (c.reported.income || c.reported.spending || c.reported.balance) ? " · partly from what you told us" : ""}`,
      status: ctx.signals.length ? "done" : "empty",
    },
    { stage: "Goal", result: ctx.goal ? ctx.goal.label : "No goal shared", status: ctx.goal ? "done" : "empty" },
    {
      stage: "Need detection",
      result: needs.length ? `${NEED_LABELS[needs[0].need]} (${needs[0].strength}/100)` : "No clear unmet need",
      status: needs.length ? "done" : "stop",
    },
    {
      stage: "Product fit",
      result: `${ranked.length} products checked → ${addressing.length} ${addressing.length === 1 ? "addresses" : "address"} a detected need`,
      status: addressing.length ? "done" : "stop",
    },
    {
      stage: "Eligibility",
      result: addressing.length
        ? `${passed.length} of ${addressing.length} ${addressing.length === 1 ? "passes" : "pass"} published conditions and guardrails`
        : "Nothing to check",
      status: passed.length ? "done" : "stop",
    },
    {
      stage: "Timing",
      result: top
        ? { appropriate: "Right time", neutral: "No time pressure", early: "Early", not_now: "Not now" }[top.timing.status]
        : passed[0]
          ? `Best remaining option scored ${passed[0].score} — below the bar`
          : "Not reached",
      status: top ? "done" : "stop",
    },
    {
      stage: "Recommendation",
      result: top
        ? `${top.product.name} · ${top.score}% match`
        : status === "no_match"
          ? "None — no match strong enough"
          : "Held back to avoid over-marketing",
      status: top ? "done" : "stop",
    },
  ];
}

export function runEngine(input: EngineInput): EngineResult {
  const now = input.now ?? new Date();
  const customer = applySelfReport(input.customer, input.selfReport, input.permissions);
  const context = buildFinancialContext(customer, input.permissions, input.goal, input.trigger ?? null);
  const needs = detectNeeds(context);
  const evaluations = input.products.map((p) => evaluateProduct(p, context, needs, input.preferences, input.history, now));
  const ranked = [...evaluations].sort(
    (a, b) => Number(Boolean(a.exclusion)) - Number(Boolean(b.exclusion)) || b.score - a.score,
  );
  const candidate = ranked.find((e) => !e.exclusion) ?? null;

  const finish = (status: DecisionStatus, top: Evaluation | null, message: string): EngineResult => {
    for (const e of ranked) if (e !== top) e.whyNot = whyNot(e, top);
    return {
      status,
      top,
      explanation: top ? explain(top, context) : null,
      ranked,
      context,
      needs,
      trace: buildTrace({ ...input, customer }, context, needs, ranked, status, top),
      message,
      generatedAt: now.toISOString(),
      modelVersion: MODEL_VERSION,
    };
  };

  // Over-marketing control: global fatigue.
  const recentDismissals = input.history.filter(
    (h) => isDismissal(h.feedback) && h.feedback_at && daysAgo(h.feedback_at, now) < FATIGUE_WINDOW_DAYS,
  );
  if (!input.requestedMore && recentDismissals.length >= FATIGUE_LIMIT) {
    return finish(
      "paused",
      null,
      "You've turned down several suggestions recently, so MoneyMap has paused recommendations. We'll only show something if you ask.",
    );
  }

  if (!candidate || candidate.band === "low") {
    return finish(
      "no_match",
      null,
      context.coverage < 0.4
        ? "With the information you've shared, we couldn't find anything that would meaningfully help. Sharing more may help — but that's always your choice."
        : "Your current financial activity doesn't show a need that any available product would meaningfully improve.",
    );
  }

  // Decision window: max one proactive recommendation per window.
  const lastDismissedInWindow = input.history.find(
    (h) => isDismissal(h.feedback) && h.product_id !== candidate.product.product_id && daysAgo(h.created_at, now) < DECISION_WINDOW_DAYS,
  );
  if (!input.requestedMore && lastDismissedInWindow) {
    return finish(
      "window_cap",
      null,
      `You've already seen a recommendation this week. To avoid over-marketing, MoneyMap shows at most one every ${DECISION_WINDOW_DAYS} days unless you ask for more.`,
    );
  }

  if (candidate.band === "potential" && !input.requestedMore && input.preferences.frequency === "highly_relevant") {
    return finish(
      "no_match",
      null,
      "We found a possible option, but it isn't a strong enough match to show under your “only highly relevant” setting.",
    );
  }

  return finish("recommended", candidate, "");
}

/** Build the stored recommendation (Phase 2 §14) from an engine result. */
export function toRecord(result: EngineResult, customerId: string): Omit<RecommendationRecord, "id" | "created_at" | "status"> | null {
  const top = result.top;
  if (!top || !result.explanation) return null;
  return {
    customer_id: customerId,
    product_id: top.product.product_id,
    product_name: top.product.name,
    category: top.product.category,
    need: top.primaryNeed,
    match_score: top.score,
    reasons: result.explanation.influences.map((i) => i.label),
    timing_reason: top.timing.reason,
    eligibility_status: top.eligibility.status,
    model_version: result.modelVersion,
  };
}

/** Shape the result as the REST response for POST /api/v1/recommendations. */
export function toApiResponse(result: EngineResult, recommendationId: string, customerId: string) {
  return {
    recommendation_id: recommendationId,
    customer_id: customerId,
    status: result.status,
    model_version: result.modelVersion,
    product: result.top ? { id: result.top.product.product_id, name: result.top.product.name } : null,
    need: result.top?.primaryNeed ?? null,
    match_score: result.top?.score ?? null,
    factors: result.top?.factors ?? null,
    reasons: result.explanation?.influences.map((i) => i.label) ?? [],
    timing: result.top ? { status: result.top.timing.status, reason: result.top.timing.reason } : null,
    eligibility_status: result.top?.eligibility.status ?? null,
    actions: result.top ? ["view_product", "apply", "feedback"] : ["view_map", "explore_products"],
    message: result.message || undefined,
  };
}

export { buildFinancialContext, detectNeeds, goalPlan, NEED_LABELS, clamp };
export type { FinancialContext, DetectedNeed };
