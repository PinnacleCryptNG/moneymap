import { describe, expect, it } from "vitest";
import { runEngine } from "..";
import { COHORT_ARCHETYPES, CUSTOMERS, PERSONA_BASES, profileFromLedger } from "../../data/customers";
import { buildLedger } from "../../data/ledgers";
import { SEED_PRODUCTS } from "../../data/products";
import type { RawTransaction } from "../../types";
import { categorise, describe as describeTx } from "../ledger";

const debit = (narration: string, channel: RawTransaction["channel"] = "transfer") => categorise({ narration, direction: "debit", channel });
const credit = (narration: string) => categorise({ narration, direction: "credit", channel: "transfer" });

describe("categoriser (narration only)", () => {
  it("recognises income on narrations it has never seen", () => {
    expect(credit("NIP/ACME FOODS PLC/SALARY OCT 2026")).toBe("salary");
    expect(credit("NIP TRF FROM ADEBAYO SEUN/SCHOOL ALLOWANCE")).toBe("allowance");
    expect(credit("NIP TRF FROM JOHN OKAFOR/REFUND")).toBe("side_income");
  });

  it("recognises common Nigerian spending", () => {
    expect(debit("NIP TRF TO MR ADEYEMI/RENT 2026-27")).toBe("rent");
    expect(debit("EKEDC PREPAID/TOKEN 1234", "bill_payment")).toBe("utilities");
    expect(debit("GOTV MAX/SUBSCRIPTION", "bill_payment")).toBe("subscriptions");
    expect(debit("AIRTIME/MTN/0803***1111", "bill_payment")).toBe("airtime_data");
    expect(debit("POS/CHICKEN REPUBLIC IKEJA/LA NG", "pos")).toBe("food");
    expect(debit("WEB/UBER/TRIP ABUJA", "web")).toBe("transport");
    expect(debit("PIGGYVEST/SAVINGS TOP UP", "web")).toBe("savings");
    expect(debit("NIP TRF TO LASU/TUITION FEES")).toBe("education");
    expect(debit("ANY ATM ANYWHERE", "atm")).toBe("cash");
  });

  it("turns bank narrations into readable descriptions", () => {
    expect(describeTx({ narration: "POS/SHOPRITE LEKKI/LA NG", direction: "debit" })).toBe("Card payment — Shoprite Lekki");
    expect(describeTx({ narration: "NIP/BRIGHTPATH LOGISTICS LTD/SALARY SEP 2026", direction: "credit" })).toBe("Salary — Brightpath Logistics Ltd");
  });
});

describe("figures derived from each persona's statement", () => {
  const by = (id: string) => COHORT_ARCHETYPES.find((c) => c.id === id)!;
  const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

  it("Sarah: ₦450,000 salary around the 25th, ₦280,000 spending", () => {
    const s = by("CUST_SARAH");
    expect(avg(s.monthlyIncome)).toBe(450000);
    expect(avg(s.monthlySpending)).toBe(280000);
    expect(s.incomeSource).toBe("salary");
    expect(s.incomeDay).toBe(25);
    expect(s.derivation?.income?.employer).toBe("Brightpath Logistics Ltd");
  });

  it("Tolu: SAVE4ME transfers count as saving, not spending", () => {
    const t = by("CUST_TOLU");
    expect(avg(t.monthlySpending)).toBe(520000);
    expect(t.derivation?.activity?.savingsTransfersMonthly).toBe(150000);
    expect(t.savingMonths).toBe(6);
  });

  it("student profile: allowance on the 1st and school payments", () => {
    const d = by("ARCH_STUDENT");
    expect(d.incomeSource).toBe("allowance");
    expect(d.incomeDay).toBe(1);
    expect(d.schoolPayments).toBe(true);
  });

  it("only bill-like payments count as fixed commitments", () => {
    const labels = by("CUST_SARAH").derivation!.spending!.recurring.map((r) => r.label);
    expect(labels.some((l) => /rent/i.test(l))).toBe(true);
    expect(labels.some((l) => /chowdeck|shoprite|bukka/i.test(l))).toBe(false);
  });
});

describe("the decision comes from the statement", () => {
  const all = { account_activity: true, income_patterns: true, spending_patterns: true, existing_products: true, financial_goals: true };
  const prefs = { categories: { savings: true, accounts: true, financing: true, cards: true }, frequency: "highly_relevant" as const };
  const sarahBase = PERSONA_BASES.find((b) => b.id === "CUST_SARAH")!;
  const goal = { ...sarahBase.defaultGoal!, id: "G", saved: 0, createdAt: "" };

  it("if Sarah's rent doubles every month, her surplus shrinks and the answer changes", () => {
    const ledger = buildLedger("CUST_SARAH");
    const months = ["04", "05", "06", "07", "08", "09"];
    const extra: RawTransaction[] = months.map((m, i) => ({
      id: `X${i}`,
      date: `2026-${m}-26`,
      narration: "NIP TRF TO NEW LANDLORD/RENT TOP UP",
      amount: 160000,
      direction: "debit",
      channel: "transfer",
    }));
    const changed = profileFromLedger(sarahBase, [...ledger, ...extra]);
    expect(changed.monthlySpending.every((x, i) => x === CUSTOMERS[0].monthlySpending[i] + 160000)).toBe(true);
    const r = runEngine({ customer: changed, permissions: all, goal, preferences: prefs, products: SEED_PRODUCTS, history: [] });
    expect(r.context.signals.some((s) => s.signal === "regular_surplus")).toBe(false);
    expect(r.top?.score ?? 0).toBeLessThan(95);
  });
});
