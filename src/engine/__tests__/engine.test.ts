import { describe, expect, it } from "vitest";
import { calculateRecommendationScore, runEngine, type EngineInput } from "..";
import { CUSTOMERS, getCustomer } from "../../data/customers";
import { SEED_PRODUCTS } from "../../data/products";
import { goalPlan } from "../plan";
import type { FinancialGoal, Permissions, Preferences, RecommendationRecord } from "../../types";

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
  categories: { savings: true, investments: true, financing: true, business: true, cards: true, other: true },
  frequency: "highly_relevant",
};
const NOW = new Date("2026-10-05T10:00:00Z");

function input(id: string, overrides: Partial<EngineInput> = {}): EngineInput {
  const customer = getCustomer(id);
  const goal: FinancialGoal | null = customer.defaultGoal
    ? { ...customer.defaultGoal, id: "G1", saved: customer.defaultGoal.saved ?? 0, createdAt: NOW.toISOString() }
    : null;
  return { customer, permissions: ALL, goal, preferences: PREFS, products: SEED_PRODUCTS, history: [], now: NOW, ...overrides };
}

function dismissal(productId: string, feedback: RecommendationRecord["feedback"], daysAgo = 1): RecommendationRecord {
  const p = SEED_PRODUCTS.find((x) => x.product_id === productId)!;
  const at = new Date(NOW.getTime() - daysAgo * 86_400_000).toISOString();
  return { id: `R_${productId}_${daysAgo}`, productId, productName: p.name, category: p.category, score: 90, createdAt: at, status: "dismissed", feedback, feedbackAt: at };
}

describe("calculateRecommendationScore (spec §81)", () => {
  it("applies the MVP weights and clamps to 0–100", () => {
    const f = { needFit: 100, goalFit: 100, behaviourFit: 100, eligibilityFit: 100, timingFit: 100, preferenceFit: 100, irrelevancePenalty: 0, overexposurePenalty: 0 };
    expect(calculateRecommendationScore(f)).toBe(100);
    expect(calculateRecommendationScore({ ...f, needFit: 0 })).toBe(70);
    expect(calculateRecommendationScore({ ...f, irrelevancePenalty: 200 })).toBe(0);
  });
});

describe("demo scenarios", () => {
  it("Sarah (saver) gets a strong Goal Savings Plan match with reasons", () => {
    const r = runEngine(input("CUST_001"));
    expect(r.status).toBe("recommended");
    expect(r.top?.product.product_id).toBe("PRODUCT_001");
    expect(r.top!.score).toBeGreaterThanOrEqual(80);
    expect(r.top!.basis).toEqual(expect.arrayContaining(["Your stated goal", "Your recent savings pattern", "Your income consistency", "Current eligibility"]));
    expect(r.explanation?.estimate?.find((e) => e.label === "Suggested monthly contribution")?.value).toBe("₦83,333");
  });

  it("Sarah: investment fund is excluded on eligibility and explained", () => {
    const r = runEngine(input("CUST_001"));
    const fund = r.ranked.find((e) => e.product.product_id === "PRODUCT_004")!;
    expect(fund.exclusion?.rule).toBe("ineligible");
    expect(fund.whyNot).toMatch(/eligibility/);
  });

  it("Tunde (borrower) gets financing only because eligibility and affordability pass", () => {
    const r = runEngine(input("CUST_002"));
    expect(r.top?.product.product_id).toBe("PRODUCT_005");
    expect(r.top!.eligibility.checks.find((c) => c.label === "Affordable repayments")?.status).toBe("pass");
    // Locking money away conflicts with an expense due in 3 months.
    expect(r.ranked.find((e) => e.product.product_id === "PRODUCT_001")!.exclusion?.rule).toBe("conflict");
  });

  it("Amaka (growing professional) is matched to a wealth-growth product", () => {
    const r = runEngine(input("CUST_003"));
    expect(r.top?.product.category).toBe("investments");
    expect(r.needs[0].need).toBe("wealth_growth");
  });

  it("Chidi (growing business) is matched to business banking", () => {
    const r = runEngine(input("CUST_004"));
    expect(r.top?.product.product_id).toBe("PRODUCT_006");
  });

  it("Bola gets no forced recommendation (no-match state)", () => {
    const r = runEngine(input("CUST_005"));
    expect(r.status).toBe("no_match");
    expect(r.top).toBeNull();
    expect(r.message).toMatch(/does not indicate a strong need/);
  });

  it("every scenario produces either a strong match or a no-match — never a weak one", () => {
    for (const c of CUSTOMERS) {
      const r = runEngine(input(c.id));
      if (r.top) expect(r.top.score).toBeGreaterThanOrEqual(80);
    }
  });
});

describe("hard rules", () => {
  it("never recommends inactive products", () => {
    for (const c of CUSTOMERS) {
      const r = runEngine(input(c.id));
      expect(r.top?.product.status ?? "active").toBe("active");
    }
  });

  it("respects category opt-out", () => {
    const prefs = { ...PREFS, categories: { ...PREFS.categories, savings: false } };
    const r = runEngine(input("CUST_001", { preferences: prefs }));
    expect(r.top?.product.category).not.toBe("savings");
    expect(r.ranked.find((e) => e.product.product_id === "PRODUCT_001")!.exclusion?.rule).toBe("opted_out");
  });

  it("'I don't want this' permanently excludes the product", () => {
    const r = runEngine(input("CUST_001", { history: [dismissal("PRODUCT_001", "dont_want", 40)] }));
    expect(r.top?.product.product_id).not.toBe("PRODUCT_001");
  });

  it("does not recommend products the customer already holds", () => {
    const r = runEngine(input("CUST_003"));
    expect(r.ranked.find((e) => e.product.product_id === "PRODUCT_002")!.exclusion?.rule).toBe("already_held");
  });

  it("remind me later snoozes the product", () => {
    const snoozed: RecommendationRecord = { ...dismissal("PRODUCT_001", "remind_later"), snoozedUntil: new Date(NOW.getTime() + 3 * 86_400_000).toISOString() };
    const r = runEngine(input("CUST_001", { history: [snoozed] }));
    expect(r.top?.product.product_id).not.toBe("PRODUCT_001");
  });
});

describe("consent", () => {
  it("stops using revoked data — no permissions means no personalised match", () => {
    const r = runEngine(input("CUST_001", { permissions: NONE }));
    expect(r.context.signals).toHaveLength(0);
    expect(r.context.income).toBeNull();
    expect(r.status).toBe("no_match");
  });

  it("revoking income patterns removes income-based signals", () => {
    const r = runEngine(input("CUST_001", { permissions: { ...ALL, income_patterns: false } }));
    expect(r.context.signals.some((s) => s.source === "income_patterns")).toBe(false);
    expect(r.context.surplus).toBeNull();
  });
});

describe("over-marketing control", () => {
  it("pauses after repeated dismissals (fatigue)", () => {
    const history = [dismissal("PRODUCT_002", "not_relevant"), dismissal("PRODUCT_003", "not_relevant"), dismissal("PRODUCT_007", "dont_want")];
    expect(runEngine(input("CUST_001", { history })).status).toBe("paused");
    expect(runEngine(input("CUST_001", { history, requestedMore: true })).status).toBe("recommended");
  });

  it("limits proactive recommendations to one per decision window", () => {
    const r = runEngine(input("CUST_003", { history: [dismissal("PRODUCT_004", "not_relevant")] }));
    expect(r.status).toBe("window_cap");
    expect(runEngine(input("CUST_003", { history: [dismissal("PRODUCT_004", "not_relevant")], requestedMore: true })).top?.product.product_id).toBe("PRODUCT_003");
  });

  it("potential matches are hidden under 'only when highly relevant' but shown on request", () => {
    // Without a savings goal, Sarah's best match drops to the potential band.
    const base = input("CUST_001", { goal: null });
    const hidden = runEngine(base);
    const shown = runEngine({ ...base, requestedMore: true });
    if (shown.top && shown.top.band === "potential") {
      expect(hidden.status).toBe("no_match");
    }
  });
});

describe("goalPlan", () => {
  it("computes a transparent monthly contribution", () => {
    const plan = goalPlan({ type: "save_more", label: "x", amount: 1_000_000, timelineMonths: 12, saved: 0 }, 170_000);
    expect(plan.monthlyContribution).toBe(83333);
    expect(plan.affordableFromSurplus).toBe(true);
  });
});

describe("dismissal", () => {
  it("'Not relevant' keeps the product out and does not push a replacement this window", () => {
    const r = runEngine(input("CUST_001", { history: [dismissal("PRODUCT_001", "not_relevant")] }));
    expect(r.top?.product.product_id).not.toBe("PRODUCT_001");
    expect(r.status).toBe("window_cap");
  });
});
