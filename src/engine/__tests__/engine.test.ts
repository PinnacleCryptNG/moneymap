import { describe, expect, it } from "vitest";
import { calculateRecommendationScore, runEngine, toRecord, type EngineInput } from "..";
import { COHORT_ARCHETYPES, CUSTOMERS } from "../../data/customers";
import { SEED_PRODUCTS } from "../../data/products";
import { goalPlan } from "../plan";
import type { FinancialGoal, GoalDraft, Permissions, Preferences, RecommendationRecord } from "../../types";

const ALL: Permissions = {
  account_activity: true,
  income_patterns: true,
  spending_patterns: true,
  existing_products: true,
  financial_goals: true,
};
const NONE: Permissions = {
  account_activity: false,
  income_patterns: false,
  spending_patterns: false,
  existing_products: false,
  financial_goals: false,
};
const PREFS: Preferences = {
  categories: { savings: true, accounts: true, financing: true, cards: true },
  frequency: "highly_relevant",
};
const NOW = new Date("2026-10-08T10:00:00Z");

function goalFrom(d: GoalDraft): FinancialGoal {
  return { ...d, id: "G1", saved: d.saved ?? 0, createdAt: NOW.toISOString() };
}

function input(id: string, overrides: Partial<EngineInput> = {}): EngineInput {
  const customer = COHORT_ARCHETYPES.find((c) => c.id === id)!;
  const goal = customer.defaultGoal ? goalFrom(customer.defaultGoal) : null;
  return { customer, permissions: ALL, goal, preferences: PREFS, products: SEED_PRODUCTS, history: [], now: NOW, ...overrides };
}

function feedback(productId: string, fb: RecommendationRecord["feedback"], daysAgo = 1): RecommendationRecord {
  const p = SEED_PRODUCTS.find((x) => x.product_id === productId)!;
  const at = new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
  return {
    id: `R_${productId}_${daysAgo}`,
    customer_id: "CUST_SARAH",
    product_id: productId,
    product_name: p.name,
    category: p.category,
    need: null,
    match_score: 90,
    reasons: [],
    timing_reason: "",
    eligibility_status: "eligible",
    model_version: "test",
    created_at: at,
    status: "dismissed",
    feedback: fb,
    feedback_at: at,
  };
}

const byId = (r: ReturnType<typeof runEngine>, id: string) => r.ranked.find((e) => e.product.product_id === id)!;

describe("calculateRecommendationScore (PRD §81)", () => {
  it("applies the MVP weights and clamps to 0–100", () => {
    const f = { needFit: 100, goalFit: 100, behaviourFit: 100, eligibilityFit: 100, timingFit: 100, preferenceFit: 100, irrelevancePenalty: 0, overexposurePenalty: 0 };
    expect(calculateRecommendationScore(f)).toBe(100);
    expect(calculateRecommendationScore({ ...f, needFit: 0 })).toBe(70);
    expect(calculateRecommendationScore({ ...f, irrelevancePenalty: 200 })).toBe(0);
  });
});

describe("Phase 2 personas", () => {
  it("Sarah (saver) gets a strong SAVE4ME match with an explained estimate", () => {
    const r = runEngine(input("CUST_SARAH"));
    expect(r.status).toBe("recommended");
    expect(r.top?.product.product_id).toBe("ZEN_SAVE4ME");
    expect(r.top!.score).toBeGreaterThanOrEqual(80);
    expect(r.explanation!.influences.map((i) => i.label)).toEqual([
      "Your goal",
      "Permitted financial behaviour",
      "Your current banking relationship",
      "Product purpose",
    ]);
    expect(r.explanation!.estimate?.find((e) => e.label === "Suggested monthly saving")?.value).toBe("₦83,333");
  });

  it("Sarah: EazySave is ruled out by its balance cap, Aspire by its published segment", () => {
    const r = runEngine(input("CUST_SARAH"));
    expect(byId(r, "ZEN_EAZYSAVE").exclusion?.rule).toBe("unsuitable");
    expect(byId(r, "ZEN_EAZYSAVE").whyNot).toMatch(/balance cap/);
    expect(byId(r, "ZEN_ASPIRE").exclusion?.rule).toBe("ineligible");
  });

  it("a student (cohort profile) gets Aspire; Personal Loan fails the published salary-account condition", () => {
    const r = runEngine(input("ARCH_STUDENT"));
    expect(r.status).toBe("recommended");
    expect(r.top?.product.product_id).toBe("ZEN_ASPIRE");
    expect(r.top!.score).toBeGreaterThanOrEqual(80);
    expect(byId(r, "ZEN_PERSONAL_LOAN").exclusion?.rule).toBe("ineligible");
  });

  it("Tolu (no-match) gets no recommendation", () => {
    const r = runEngine(input("CUST_TOLU"));
    expect(r.status).toBe("no_match");
    expect(r.top).toBeNull();
    expect(byId(r, "ZEN_SAVE4ME").exclusion?.rule).toBe("already_held");
    expect(byId(r, "ZEN_CREDIT_CARD").exclusion?.rule).toBe("already_held");
    expect(r.trace.at(-1)?.result).toMatch(/None/);
  });

  it("every persona produces a strong match or no match — never a weak one", () => {
    for (const c of CUSTOMERS) {
      const r = runEngine(input(c.id));
      if (r.top) expect(r.top.score).toBeGreaterThanOrEqual(80);
    }
  });
});

describe("context changes the decision (live demo)", () => {
  it("Tolu with a new savings goal is offered a separate SAVE4ME", () => {
    const goal = goalFrom({ type: "save_more", label: "Save ₦2,000,000", amount: 2_000_000, timelineMonths: 12 });
    const r = runEngine(input("CUST_TOLU", { goal }));
    expect(r.top?.product.product_id).toBe("ZEN_SAVE4ME");
  });

  it("a car purchase the surplus can't cover in time points to Asset Finance", () => {
    const goal = goalFrom({ type: "major_expense", expenseKind: "vehicle", label: "Buy a car", amount: 6_000_000, timelineMonths: 12 });
    const r = runEngine(input("CUST_TOLU", { goal }));
    expect(r.top?.product.product_id).toBe("ZEN_ASSET_FINANCE");
    expect(r.explanation?.estimateNote).toMatch(/Principal only/);
  });

  it("a rent payment due soon points Sarah to a Personal Loan, and locks out SAVE4ME", () => {
    const goal = goalFrom({ type: "major_expense", expenseKind: "rent", label: "Pay my rent", amount: 1_800_000, timelineMonths: 3 });
    const r = runEngine(input("CUST_SARAH", { goal }));
    expect(r.top?.product.product_id).toBe("ZEN_PERSONAL_LOAN");
    expect(byId(r, "ZEN_SAVE4ME").exclusion?.rule).toBe("conflict");
  });
});

describe("catalogue integrity (Phase 2 §10)", () => {
  it("every published fact cites a source", () => {
    for (const p of SEED_PRODUCTS) for (const f of p.published) expect(f.source).toMatch(/^https:\/\//);
  });

  it("estimates never include an interest rate", () => {
    for (const c of CUSTOMERS) {
      const r = runEngine(input(c.id));
      for (const e of r.explanation?.estimate ?? []) expect(e.value).not.toMatch(/%.*(rate|interest)/i);
    }
  });
});

describe("hard rules", () => {
  it("respects category opt-out", () => {
    const r = runEngine(input("CUST_SARAH", { preferences: { ...PREFS, categories: { ...PREFS.categories, savings: false } } }));
    expect(r.top?.product.category).not.toBe("savings");
    expect(byId(r, "ZEN_SAVE4ME").exclusion?.rule).toBe("opted_out");
  });

  it("'I don't want this' permanently excludes the product", () => {
    const r = runEngine(input("CUST_SARAH", { history: [feedback("ZEN_SAVE4ME", "not_wanted", 40)] }));
    expect(r.top?.product.product_id).not.toBe("ZEN_SAVE4ME");
  });

  it("never recommends an inactive product", () => {
    const products = SEED_PRODUCTS.map((p) => (p.product_id === "ZEN_ASPIRE" ? { ...p, status: "inactive" as const } : p));
    const r = runEngine(input("ARCH_STUDENT", { products }));
    expect(r.top?.product.product_id).not.toBe("ZEN_ASPIRE");
  });

  it("doesn't recommend a product the customer has already requested", () => {
    const applied = { ...feedback("ZEN_SAVE4ME", "useful"), status: "applied" as const };
    const r = runEngine(input("CUST_SARAH", { history: [applied] }));
    expect(r.top?.product.product_id).not.toBe("ZEN_SAVE4ME");
    expect(byId(r, "ZEN_SAVE4ME").whyNot).toMatch(/already asked/);
  });

  it("remind me later snoozes the product", () => {
    const snoozed = { ...feedback("ZEN_SAVE4ME", "remind_later"), snoozed_until: new Date(NOW.getTime() + 3 * 86_400_000).toISOString() };
    const r = runEngine(input("CUST_SARAH", { history: [snoozed] }));
    expect(r.top?.product.product_id).not.toBe("ZEN_SAVE4ME");
  });
});

describe("consent", () => {
  it("no permissions means no personalised match", () => {
    const r = runEngine(input("CUST_SARAH", { permissions: NONE }));
    expect(r.context.signals).toHaveLength(0);
    expect(r.context.income).toBeNull();
    expect(r.status).toBe("no_match");
  });

  it("revoking income patterns removes income-based signals", () => {
    const r = runEngine(input("CUST_SARAH", { permissions: { ...ALL, income_patterns: false } }));
    expect(r.context.signals.some((s) => s.source === "income_patterns")).toBe(false);
    expect(r.context.surplus).toBeNull();
  });
});

describe("exposure control", () => {
  it("'Not relevant' keeps the product out and doesn't push a replacement this week", () => {
    const r = runEngine(input("CUST_SARAH", { history: [feedback("ZEN_SAVE4ME", "not_relevant")] }));
    expect(r.top?.product.product_id).not.toBe("ZEN_SAVE4ME");
    expect(["window_cap", "no_match"]).toContain(r.status);
  });

  it("pauses after repeated dismissals (fatigue), unless the customer asks", () => {
    const history = [feedback("ZEN_EAZYSAVE", "not_relevant"), feedback("ZEN_CREDIT_CARD", "not_relevant"), feedback("ZEN_ASPIRE", "not_wanted")];
    expect(runEngine(input("CUST_SARAH", { history })).status).toBe("paused");
    expect(runEngine(input("CUST_SARAH", { history, requestedMore: true })).status).toBe("recommended");
  });
});

describe("stored recommendation (Phase 2 §14)", () => {
  it("carries the required fields", () => {
    const rec = toRecord(runEngine(input("CUST_SARAH")), "CUST_SARAH")!;
    for (const k of ["customer_id", "product_id", "need", "match_score", "reasons", "timing_reason", "eligibility_status"]) {
      expect(rec).toHaveProperty(k);
    }
    expect(rec.need).toBe("goal_saving");
  });
});

describe("goalPlan", () => {
  it("computes a transparent monthly contribution", () => {
    const plan = goalPlan({ type: "save_more", label: "x", amount: 1_000_000, timelineMonths: 12, saved: 0 }, 170_000);
    expect(plan.monthlyContribution).toBe(83333);
    expect(plan.affordableFromSurplus).toBe(true);
  });
});
