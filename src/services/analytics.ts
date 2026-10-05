// Synthetic cohort analytics for the bank dashboard.
// Generates a deterministic population of anonymised customers from the five archetypes,
// runs the real decision engine over them, and simulates responses so that every metric
// reflects the current catalogue and rules.
import { CUSTOMERS } from "../data/customers";
import { runEngine, type EngineResult } from "../engine";
import type {
  CustomerProfile,
  FeedbackType,
  FinancialGoal,
  FinancialNeed,
  Permissions,
  Product,
} from "../types";
import { DEFAULT_PREFERENCES } from "../data/defaults";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CohortMember {
  archetype: string;
  result: EngineResult;
  response: FeedbackType | null;
  applied: boolean;
  completed: boolean;
}

export interface ProductStat {
  product: Product;
  recommended: number;
  accepted: number;
  rejected: number;
  useful: number;
  avgScore: number;
}

export interface CohortMetrics {
  customers: number;
  recommended: number;
  noMatch: number;
  paused: number;
  useful: number;
  accepted: number;
  completed: number;
  rejected: number;
  dontUnderstand: number;
  remindLater: number;
  unexplained: number;
  optOuts: number;
  complaints: number;
  failedEligibility: number;
  products: ProductStat[];
  needs: { need: FinancialNeed; count: number }[];
  segments: { archetype: string; customers: number; topProduct: string; matchRate: number }[];
}

function perturb(base: CustomerProfile, r: () => number, i: number): CustomerProfile {
  const incomeScale = 0.7 + r() * 0.8;
  const spendScale = incomeScale * (0.85 + r() * 0.35);
  return {
    ...base,
    id: `SYN_${i}`,
    age: Math.max(19, Math.round(base.age + (r() - 0.5) * 12)),
    monthlyIncome: base.monthlyIncome.map((v) => Math.round(v * incomeScale * (0.97 + r() * 0.06))),
    monthlySpending: base.monthlySpending.map((v) => Math.round(v * spendScale * (0.95 + r() * 0.1))),
    averageBalance: Math.round(base.averageBalance * (0.5 + r() * 1.2)),
    savingMonths: Math.max(0, Math.min(6, base.savingMonths + Math.round((r() - 0.5) * 3))),
    businessInflows: base.businessInflows?.map((v) => Math.round(v * (0.6 + r() * 0.8))),
  };
}

function respond(r: () => number, band: string): FeedbackType | null {
  const x = r();
  if (band === "strong") {
    if (x < 0.56) return "useful";
    if (x < 0.66) return "not_relevant";
    if (x < 0.7) return "dont_want";
    if (x < 0.78) return "remind_later";
    if (x < 0.81) return "dont_understand";
    return null;
  }
  if (x < 0.32) return "useful";
  if (x < 0.55) return "not_relevant";
  if (x < 0.62) return "dont_want";
  if (x < 0.72) return "remind_later";
  if (x < 0.77) return "dont_understand";
  return null;
}

export function simulateCohort(products: Product[], size = 250, seed = 6): CohortMetrics {
  const r = rng(seed);
  const members: CohortMember[] = [];
  let optOuts = 0;

  for (let i = 0; i < size; i++) {
    const base = CUSTOMERS[i % CUSTOMERS.length];
    const customer = perturb(base, r, i);
    const permissions: Permissions = {
      account_activity: r() < 0.88,
      income_patterns: r() < 0.85,
      spending_patterns: r() < 0.82,
      existing_products: r() < 0.9,
      financial_goals: r() < 0.93,
    };
    const prefs = { ...DEFAULT_PREFERENCES, categories: { ...DEFAULT_PREFERENCES.categories } };
    if (r() < 0.05) {
      prefs.categories.cards = false;
      optOuts++;
    }
    const g = base.defaultGoal;
    const goal: FinancialGoal | null = g
      ? { ...g, amount: Math.round(g.amount * (0.6 + r() * 0.9)), id: `G${i}`, saved: 0, createdAt: "2026-09-01T00:00:00Z" }
      : null;
    const result = runEngine({
      customer,
      permissions,
      goal,
      preferences: prefs,
      products,
      history: [],
      now: new Date("2026-10-05T09:00:00Z"),
    });
    const response = result.top ? respond(r, result.top.band) : null;
    const applied = response === "useful" && r() < 0.62;
    members.push({ archetype: base.persona, result, response, applied, completed: applied && r() < 0.74 });
  }

  const recs = members.filter((m) => m.result.top);
  const count = (f: FeedbackType) => recs.filter((m) => m.response === f).length;

  const stats = new Map<string, ProductStat>();
  for (const p of products) stats.set(p.product_id, { product: p, recommended: 0, accepted: 0, rejected: 0, useful: 0, avgScore: 0 });
  for (const m of recs) {
    const s = stats.get(m.result.top!.product.product_id)!;
    s.recommended++;
    s.avgScore += m.result.top!.score;
    if (m.applied) s.accepted++;
    if (m.response === "useful") s.useful++;
    if (m.response === "not_relevant" || m.response === "dont_want") s.rejected++;
  }
  for (const s of stats.values()) s.avgScore = s.recommended ? Math.round(s.avgScore / s.recommended) : 0;

  const needCounts = new Map<FinancialNeed, number>();
  for (const m of members) {
    const top = m.result.needs[0];
    if (top) needCounts.set(top.need, (needCounts.get(top.need) ?? 0) + 1);
  }

  const archetypes = [...new Set(members.map((m) => m.archetype))];
  const segments = archetypes.map((a) => {
    const ms = members.filter((m) => m.archetype === a);
    const tally = new Map<string, number>();
    for (const m of ms) if (m.result.top) tally.set(m.result.top.product.name, (tally.get(m.result.top.product.name) ?? 0) + 1);
    const top = [...tally.entries()].sort((x, y) => y[1] - x[1])[0];
    return {
      archetype: a,
      customers: ms.length,
      topProduct: top?.[0] ?? "No match",
      matchRate: ms.filter((m) => m.result.top).length / ms.length,
    };
  });

  return {
    customers: size,
    recommended: recs.length,
    noMatch: members.filter((m) => m.result.status === "no_match").length,
    paused: members.filter((m) => m.result.status === "paused").length,
    useful: count("useful"),
    accepted: recs.filter((m) => m.applied).length,
    completed: recs.filter((m) => m.completed).length,
    rejected: count("not_relevant") + count("dont_want"),
    dontUnderstand: count("dont_understand"),
    remindLater: count("remind_later"),
    unexplained: recs.filter((m) => !m.result.explanation).length,
    optOuts,
    complaints: Math.round(size * 0.004),
    failedEligibility: recs.filter((m) => m.result.top!.eligibility.status === "ineligible").length,
    products: [...stats.values()].sort((a, b) => b.recommended - a.recommended),
    needs: [...needCounts.entries()].map(([need, c]) => ({ need, count: c })).sort((a, b) => b.count - a.count),
    segments,
  };
}
