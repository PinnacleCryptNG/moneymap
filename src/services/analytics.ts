// Synthetic cohort analytics for the bank view (Phase 2 §16).
// Builds a deterministic population of anonymised customers from the demo archetypes, then runs
// the real decision engine over four weekly decision rounds per customer, feeding simulated
// responses back in. Fatigue, caps and no-match outcomes are therefore genuine engine behaviour.
import { CUSTOMERS } from "../data/customers";
import { DEFAULT_PREFERENCES } from "../data/defaults";
import { runEngine, toRecord, isDismissal, REMIND_LATER_DAYS } from "../engine";
import type {
  CustomerProfile,
  ExistingProductId,
  FeedbackType,
  FinancialGoal,
  FinancialNeed,
  Permissions,
  Product,
  RecommendationRecord,
} from "../types";

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

export const ROUNDS = 4;

/** Cohort groups, named by who they are rather than by the demo persona. */
const GROUP: Record<string, string> = {
  CUST_SARAH: "Salaried, building savings",
  CUST_DANIEL: "Students",
  CUST_TOLU: "Established, already well served",
};

export interface ProductStat {
  product: Product;
  recommended: number;
  accepted: number;
  rejected: number;
  dismissed: number;
  useful: number;
  avgScore: number;
  needs: Partial<Record<FinancialNeed, number>>;
}

export interface CohortMetrics {
  customers: number;
  decisions: number;
  generated: number;
  accepted: number;
  rejected: number;
  dismissed: number;
  noMatch: number;
  useful: number;
  notRelevant: number;
  notUnderstood: number;
  remindLater: number;
  windowCapped: number;
  paused: number;
  exposuresPerCustomer: number;
  maxExposures: number;
  repeatAfterDismissal: number;
  unexplained: number;
  products: ProductStat[];
  needTotals: { need: FinancialNeed; count: number }[];
  segments: { archetype: string; customers: number; topProduct: string; matchRate: number }[];
}

const HOLDING_FOR: Partial<Record<string, ExistingProductId>> = {
  ZEN_SAVE4ME: "save4me",
  ZEN_ASPIRE: "aspire",
  ZEN_EAZYSAVE: "eazysave",
  ZEN_PERSONAL_LOAN: "personal_loan",
  ZEN_ASSET_FINANCE: "asset_finance",
  ZEN_CREDIT_CARD: "credit_card",
};

function perturb(base: CustomerProfile, r: () => number, i: number): CustomerProfile {
  const incomeScale = 0.75 + r() * 0.6;
  const spendScale = incomeScale * (0.85 + r() * 0.35);
  return {
    ...base,
    id: `SYN_${i}`,
    age: Math.max(18, Math.round(base.age + (r() - 0.5) * (base.segment === "student" ? 4 : 14))),
    monthlyIncome: base.monthlyIncome.map((v) => Math.round(v * incomeScale * (0.97 + r() * 0.06))),
    monthlySpending: base.monthlySpending.map((v) => Math.round(v * spendScale * (0.95 + r() * 0.1))),
    averageBalance: Math.round(base.averageBalance * (0.5 + r() * 1.2)),
    savingMonths: Math.max(0, Math.min(6, base.savingMonths + Math.round((r() - 0.5) * 3))),
    existingProducts: base.existingProducts.filter((h) => h === "current_account" || h === "debit_card" || r() < 0.75),
  };
}

function randomGoal(c: CustomerProfile, r: () => number, i: number): FinancialGoal | null {
  const x = r();
  const id = `G${i}`;
  const createdAt = "2026-09-01T00:00:00Z";
  const income = c.monthlyIncome[5];
  if (c.segment === "student") {
    if (x < 0.6) return { type: "everyday", label: "Manage my everyday money", amount: 0, timelineMonths: 12, saved: 0, id, createdAt };
    if (x < 0.8) return { type: "save_more", label: "Save for a laptop", amount: Math.round(300000 + r() * 400000), timelineMonths: 10, saved: 0, id, createdAt };
    return null;
  }
  if (x < 0.35) return { type: "save_more", label: "Save for a goal", amount: Math.round(income * (1.5 + r() * 2.5)), timelineMonths: 12, saved: 0, id, createdAt };
  if (x < 0.5) return { type: "major_expense", expenseKind: "rent", label: "Pay my rent", amount: Math.round(income * (2.5 + r() * 2)), timelineMonths: 3 + Math.round(r() * 3), saved: 0, id, createdAt };
  if (x < 0.62) return { type: "major_expense", expenseKind: "vehicle", label: "Buy a car", amount: Math.round(income * (6 + r() * 6)), timelineMonths: 12, saved: 0, id, createdAt };
  if (x < 0.75) return { type: "grow_money", label: "Grow my money", amount: 0, timelineMonths: 12, saved: 0, id, createdAt };
  return { type: "not_sure", label: "Not sure yet", amount: 0, timelineMonths: 12, saved: 0, id, createdAt };
}

function respond(r: () => number, band: string): FeedbackType | null {
  const x = r();
  const strong = band === "strong";
  if (x < (strong ? 0.55 : 0.3)) return "useful";
  if (x < (strong ? 0.65 : 0.52)) return "not_relevant";
  if (x < (strong ? 0.69 : 0.6)) return "not_wanted";
  if (x < (strong ? 0.77 : 0.7)) return "remind_later";
  if (x < (strong ? 0.8 : 0.75)) return "not_understood";
  return null;
}

export function simulateCohort(products: Product[], size = 240, seed = 8): CohortMetrics {
  const r = rng(seed);
  const start = new Date("2026-09-08T09:00:00Z").getTime();
  const stats = new Map<string, ProductStat>();
  for (const p of products) stats.set(p.product_id, { product: p, recommended: 0, accepted: 0, rejected: 0, dismissed: 0, useful: 0, avgScore: 0, needs: {} });

  const m: CohortMetrics = {
    customers: size, decisions: 0, generated: 0, accepted: 0, rejected: 0, dismissed: 0, noMatch: 0, useful: 0,
    notRelevant: 0, notUnderstood: 0, remindLater: 0, windowCapped: 0, paused: 0, exposuresPerCustomer: 0,
    maxExposures: 0, repeatAfterDismissal: 0, unexplained: 0, products: [], needTotals: [], segments: [],
  };
  const needTotals = new Map<FinancialNeed, number>();
  const segment = new Map<string, { customers: number; matched: number; tally: Map<string, number> }>();

  for (let i = 0; i < size; i++) {
    const base = CUSTOMERS[i % CUSTOMERS.length];
    const customer = perturb(base, r, i);
    const permissions: Permissions = {
      account_activity: r() < 0.9,
      income_patterns: r() < 0.88,
      spending_patterns: r() < 0.85,
      existing_products: r() < 0.92,
      financial_goals: r() < 0.94,
    };
    const goal = randomGoal(customer, r, i);
    const history: RecommendationRecord[] = [];
    const group = GROUP[base.id] ?? base.persona;
    const seg = segment.get(group) ?? { customers: 0, matched: 0, tally: new Map() };
    seg.customers++;
    let exposures = 0;
    let matched = false;

    for (let w = 0; w < ROUNDS; w++) {
      const now = new Date(start + w * 7 * 86_400_000);
      const result = runEngine({ customer, permissions, goal, preferences: DEFAULT_PREFERENCES, products, history, now });
      m.decisions++;
      if (w === 0 && result.needs[0]) needTotals.set(result.needs[0].need, (needTotals.get(result.needs[0].need) ?? 0) + 1);
      if (result.status === "no_match") m.noMatch++;
      if (result.status === "window_cap") m.windowCapped++;
      if (result.status === "paused") m.paused++;
      const rec = toRecord(result, customer.id);
      if (!rec) continue;

      // An unanswered recommendation still on screen isn't a new exposure.
      const open = history.find((h) => h.product_id === rec.product_id && !h.feedback && h.status !== "applied");
      if (open) continue;
      if (history.some((h) => h.product_id === rec.product_id && isDismissal(h.feedback))) m.repeatAfterDismissal++;
      if (!result.explanation) m.unexplained++;

      exposures++;
      matched = true;
      m.generated++;
      const s = stats.get(rec.product_id)!;
      s.recommended++;
      s.avgScore += rec.match_score;
      if (rec.need) s.needs[rec.need] = (s.needs[rec.need] ?? 0) + 1;
      seg.tally.set(rec.product_name, (seg.tally.get(rec.product_name) ?? 0) + 1);

      const fb = respond(r, result.top!.band);
      const applied = fb === "useful" && r() < 0.6;
      const record: RecommendationRecord = {
        ...rec,
        id: `${customer.id}_${w}`,
        created_at: now.toISOString(),
        status: applied ? "applied" : fb === "remind_later" ? "snoozed" : isDismissal(fb ?? undefined) ? "dismissed" : "recommended",
        feedback: fb ?? undefined,
        feedback_at: fb ? now.toISOString() : undefined,
        snoozed_until: fb === "remind_later" ? new Date(now.getTime() + REMIND_LATER_DAYS * 86_400_000).toISOString() : undefined,
      };
      history.push(record);
      if (fb === "useful") { m.useful++; s.useful++; }
      if (fb === "not_relevant") { m.notRelevant++; m.dismissed++; s.dismissed++; }
      if (fb === "remind_later") { m.remindLater++; m.dismissed++; s.dismissed++; }
      if (fb === "not_wanted") { m.rejected++; s.rejected++; }
      if (fb === "not_understood") m.notUnderstood++;
      if (applied) {
        m.accepted++;
        s.accepted++;
        const holding = HOLDING_FOR[rec.product_id];
        if (holding) customer.existingProducts = [...customer.existingProducts, holding];
      }
    }
    m.exposuresPerCustomer += exposures;
    m.maxExposures = Math.max(m.maxExposures, exposures);
    if (matched) seg.matched++;
    segment.set(group, seg);
  }

  m.exposuresPerCustomer = m.exposuresPerCustomer / size;
  for (const s of stats.values()) s.avgScore = s.recommended ? Math.round(s.avgScore / s.recommended) : 0;
  m.products = [...stats.values()].sort((a, b) => b.recommended - a.recommended);
  m.needTotals = [...needTotals.entries()].map(([need, count]) => ({ need, count })).sort((a, b) => b.count - a.count);
  m.segments = [...segment.entries()].map(([archetype, v]) => {
    const top = [...v.tally.entries()].sort((a, b) => b[1] - a[1])[0];
    return { archetype, customers: v.customers, topProduct: top?.[0] ?? "No match", matchRate: v.matched / v.customers };
  });
  return m;
}
