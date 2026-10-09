import { describe, expect, it } from "vitest";
import { runEngine, type EngineInput } from "..";
import { CUSTOMERS } from "../../data/customers";
import { DEFAULT_PREFERENCES } from "../../data/defaults";
import { SEED_PRODUCTS } from "../../data/products";
import type { AppNotification, Permissions } from "../../types";
import { decideOnTrigger, detectTrigger, simulatedCredit } from "../triggers";

const ALL: Permissions = { account_activity: true, income_patterns: true, spending_patterns: true, existing_products: true, financial_goals: true };
const sarah = CUSTOMERS.find((c) => c.id === "CUST_SARAH")!;
const tolu = CUSTOMERS.find((c) => c.id === "CUST_TOLU")!;
const NOW = new Date("2026-10-08T09:00:00Z");
const input = (c = sarah, extra: Partial<EngineInput> = {}): EngineInput => ({
  customer: c,
  permissions: ALL,
  goal: c.defaultGoal ? { ...c.defaultGoal, id: "G", saved: 0, createdAt: "" } : null,
  preferences: DEFAULT_PREFERENCES,
  products: SEED_PRODUCTS,
  history: [],
  now: NOW,
  ...extra,
});

describe("detectTrigger", () => {
  it("treats salary landing as income, a large one-off credit as a windfall, and ignores the rest", () => {
    expect(detectTrigger(simulatedCredit("income", sarah, "2026-10-08", "T1"), sarah)).toMatchObject({ type: "income_received", amount: 450000, description: "Salary — Brightpath Logistics Ltd" });
    const bonus = detectTrigger(simulatedCredit("windfall", sarah, "2026-10-08", "T2"), sarah);
    expect(bonus).toMatchObject({ type: "windfall", amount: 900000, description: "Performance bonus 2026 — Brightpath Logistics Ltd" });
    expect(detectTrigger({ id: "T3", date: "2026-10-08", narration: "NIP TRF FROM AMAKA/REFUND", amount: 15000, direction: "credit", channel: "transfer" }, sarah)).toBeNull();
    expect(detectTrigger({ id: "T4", date: "2026-10-08", narration: "POS/SHOPRITE LEKKI/LA NG", amount: 900000, direction: "debit", channel: "pos" }, sarah)).toBeNull();
  });
});

describe("the engine with a trigger", () => {
  const trigger = detectTrigger(simulatedCredit("income", sarah, "2026-10-08", "T1"), sarah)!;

  it("uses the moment as the timing reason and shows it in the trace", () => {
    const r = runEngine(input(sarah, { trigger }));
    expect(r.top?.product.product_id).toBe("ZEN_SAVE4ME");
    expect(r.explanation?.whyNow).toMatch(/salary of ₦450,000 has just arrived/);
    expect(r.trace[1]).toMatchObject({ stage: "What happened" });
  });

  it("ignores the trigger when income data isn't shared", () => {
    const r = runEngine(input(sarah, { trigger, permissions: { ...ALL, income_patterns: false } }));
    expect(r.trace.some((s) => s.stage === "What happened")).toBe(false);
  });
});

describe("decideOnTrigger", () => {
  const trigger = { type: "income_received" as const, amount: 450000, description: "Salary — Brightpath Logistics Ltd" };

  it("notifies on a strong match, as a reminder if the recommendation is already open", () => {
    const result = runEngine(input(sarah, { trigger }));
    expect(decideOnTrigger({ trigger, permissions: ALL, result, history: [], notifications: [], now: NOW })).toMatchObject({ outcome: "notified", kind: "new_recommendation" });
    const open = { product_id: "ZEN_SAVE4ME", status: "recommended" } as never;
    expect(decideOnTrigger({ trigger, permissions: ALL, result, history: [open], notifications: [], now: NOW })).toMatchObject({ outcome: "notified", kind: "reminder" });
  });

  it("holds back with no match, a message this week, or no income permission", () => {
    const quiet = decideOnTrigger({ trigger, permissions: ALL, result: runEngine(input(tolu, { trigger })), history: [], notifications: [], now: NOW });
    expect(quiet.outcome).toBe("held_back");
    const recent = { created_at: "2026-10-05T09:00:00Z" } as AppNotification;
    const result = runEngine(input(sarah, { trigger }));
    expect(decideOnTrigger({ trigger, permissions: ALL, result, history: [], notifications: [recent], now: NOW }).outcome).toBe("held_back");
    const old = { created_at: "2026-09-20T09:00:00Z" } as AppNotification;
    expect(decideOnTrigger({ trigger, permissions: ALL, result, history: [], notifications: [old], now: NOW }).outcome).toBe("notified");
    expect(decideOnTrigger({ trigger, permissions: { ...ALL, income_patterns: false }, result, history: [], notifications: [], now: NOW }).outcome).toBe("held_back");
  });
});
