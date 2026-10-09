import { describe, expect, it } from "vitest";
import { runEngine } from "..";
import { CUSTOMERS } from "../../data/customers";
import { DEFAULT_PREFERENCES } from "../../data/defaults";
import { SEED_PRODUCTS } from "../../data/products";
import type { Permissions, SelfReport } from "../../types";
import { applySelfReport, mid, reportedBalance, reportedIncome, reportedSpending } from "../selfReport";

const NONE: Permissions = { account_activity: false, income_patterns: false, spending_patterns: false, existing_products: false, financial_goals: false };
const ALL: Permissions = { account_activity: true, income_patterns: true, spending_patterns: true, existing_products: true, financial_goals: true };
const sarah = CUSTOMERS.find((c) => c.id === "CUST_SARAH")!;
const goal = { type: "save_more" as const, label: "School fees", amount: 100000, timelineMonths: 6, saved: 0, id: "G", createdAt: "" };

const report = (over: Partial<SelfReport> = {}): SelfReport => ({
  accounts: [{ kind: "personal", amount: { kind: "exact", value: 120000 } }, { kind: "business", amount: { kind: "exact", value: 900000 } }],
  fixedIncome: { kind: "exact", value: 300000 },
  variableIncome: [{ title: "Hair business", amount: { kind: "range", min: 50000, max: 150000 } }],
  expenses: { mode: "itemised", items: [
    { category: "Food", amount: { kind: "range", min: 60000, max: 80000 } },
    { category: "Rent", amount: { kind: "exact", value: 50000 } },
    { category: "Electricity", amount: { kind: "unsure" } },
  ] },
  updatedAt: "",
  ...over,
});

describe("reading the customer's own answers", () => {
  it("uses midpoints for ranges and ignores 'not sure'", () => {
    expect(mid({ kind: "range", min: 10000, max: 20000 })).toBe(15000);
    expect(mid({ kind: "unsure" })).toBeNull();
  });

  it("varies income by its range and pairs low income with high spending", () => {
    const r = report();
    expect(reportedIncome(r)).toEqual([350000, 450000, 350000, 450000, 350000, 450000]);
    expect(reportedSpending(r)).toEqual([130000, 110000, 130000, 110000, 130000, 110000]);
  });

  it("counts personal and savings money as available, not business or investments", () => {
    expect(reportedBalance(report())).toBe(120000);
  });

  it("all 'not sure' means no figure at all, never zero", () => {
    expect(reportedSpending(report({ expenses: { mode: "unsure" } }))).toBeNull();
    expect(reportedIncome(report({ fixedIncome: null, variableIncome: [{ title: "Gigs", amount: { kind: "unsure" } }] }))).toBeNull();
  });
});

describe("answers in the decision", () => {
  it("fill in what isn't shared, and the reasons say so", () => {
    const r = runEngine({ customer: sarah, permissions: { ...NONE, financial_goals: true }, goal, preferences: DEFAULT_PREFERENCES, products: SEED_PRODUCTS, history: [], selfReport: report() });
    expect(r.context.income?.average).toBe(400000);
    expect(r.context.spending?.recurring).toBe(50000);
    const surplus = r.context.signals.find((s) => s.signal === "regular_surplus");
    expect(surplus?.source).toBe("self_reported");
    expect(surplus?.evidence).toMatch(/Based on what you told us/);
    expect(r.top?.product.product_id).toBe("ZEN_SAVE4ME");
    expect(r.explanation?.dataUsed).toContain("self_reported");
    expect(r.trace.find((s) => s.stage === "Your money")?.result).toMatch(/partly from what you told us/);
  });

  it("never override a statement the customer has shared", () => {
    const c = applySelfReport(sarah, report(), ALL);
    expect(c.monthlyIncome).toEqual(sarah.monthlyIncome);
    expect(c.reported).toEqual({ income: false, spending: false, balance: false });
  });

  it("with no answers and nothing shared, there's still no income figure", () => {
    const r = runEngine({ customer: sarah, permissions: NONE, goal: null, preferences: DEFAULT_PREFERENCES, products: SEED_PRODUCTS, history: [], selfReport: null });
    expect(r.context.income).toBeNull();
  });
});
