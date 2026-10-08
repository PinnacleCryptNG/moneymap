// Synthetic six-month bank statements for the demo personas (Phase 2 §12: realistic Nigerian data).
// Narrations follow common Nigerian bank statement formats. All names, employers and accounts are fictional.
// Statements are generated deterministically, so the demo is identical every time.
import type { Channel, RawTransaction } from "../types";

/** The demo's "today". Statements cover the six complete calendar months before it. */
export const DEMO_TODAY = "2026-10-08";
const YEAR = 2026;
/** April–September 2026 (0-based month numbers). */
export const ANALYSIS_MONTHS = [3, 4, 5, 6, 7, 8];
const MONTH_ABBR = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

interface Line {
  day: number;
  narration: string;
  amount: number;
  channel: Channel;
}

interface Discretionary {
  narration: string;
  channel: Channel;
  min: number;
  max: number;
  weight: number;
}

interface LedgerPlan {
  seed: number;
  /** Money in each month (index 0 = April). */
  credits: (i: number, mon: string) => Line[];
  /** Regular debits each month. */
  fixed: (i: number, mon: string) => Line[];
  /** Transfers into savings each month (not spending). */
  savings?: (i: number, mon: string) => Line[];
  /** Total spending per month, fixed + day-to-day. */
  spendTarget: number[];
  discretionary: Discretionary[];
  /** 1–8 October, shown as recent activity but outside the analysed months. */
  recent: Line[];
}

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

const iso = (month: number, day: number) => `${YEAR}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

function generate(customerId: string, plan: LedgerPlan): RawTransaction[] {
  const r = rng(plan.seed);
  const out: Omit<RawTransaction, "id">[] = [];
  const push = (month: number, l: Line, direction: RawTransaction["direction"]) =>
    out.push({ date: iso(month, l.day), narration: l.narration, amount: Math.round(l.amount), direction, channel: l.channel });

  ANALYSIS_MONTHS.forEach((month, i) => {
    const mon = MONTH_ABBR[month];
    for (const l of plan.credits(i, mon)) if (l.amount > 0) push(month, l, "credit");
    for (const l of plan.savings?.(i, mon) ?? []) push(month, l, "debit");
    const fixed = plan.fixed(i, mon);
    for (const l of fixed) push(month, l, "debit");

    // Day-to-day spending fills the rest of the month's budget.
    let remaining = plan.spendTarget[i] - fixed.reduce((a, l) => a + l.amount, 0);
    const totalWeight = plan.discretionary.reduce((a, d) => a + d.weight, 0);
    const smallest = Math.min(...plan.discretionary.map((d) => d.min));
    while (remaining >= smallest) {
      let pick = r() * totalWeight;
      const d = plan.discretionary.find((x) => (pick -= x.weight) < 0) ?? plan.discretionary[0];
      let amount = Math.round((d.min + r() * (d.max - d.min)) / 50) * 50;
      if (amount > remaining || remaining - amount < smallest) amount = remaining;
      push(month, { day: 1 + Math.floor(r() * 28), narration: d.narration, amount, channel: d.channel }, "debit");
      remaining -= amount;
    }
    // Fold any small remainder into the last purchase so the month adds up exactly.
    if (remaining > 0) out[out.length - 1].amount += remaining;
  });
  for (const l of plan.recent) out.push({ date: iso(9, l.day), narration: l.narration, amount: l.amount, direction: l.narration.startsWith("NIP TRF FROM") || /SALARY/.test(l.narration) ? "credit" : "debit", channel: l.channel });

  return out
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((t, i) => ({ ...t, id: `${customerId}-${String(i + 1).padStart(4, "0")}` }));
}

const PLANS: Record<string, { openingBalance: number; plan: LedgerPlan }> = {
  CUST_SARAH: {
    openingBalance: 110000,
    plan: {
      seed: 24,
      credits: (i, mon) => [
        { day: 25, narration: `NIP/BRIGHTPATH LOGISTICS LTD/SALARY ${mon} ${YEAR}`, amount: [445000, 450000, 450000, 450000, 450000, 455000][i], channel: "transfer" },
      ],
      fixed: () => [
        { day: 26, narration: "NIP TRF TO ADAEZE NWOSU/RENT CONTRIBUTION", amount: 60000, channel: "transfer" },
        { day: 27, narration: "IKEDC PREPAID/TOKEN 4512 8803 2210", amount: 15000, channel: "bill_payment" },
        { day: 27, narration: "MTN DATA/25GB MONTHLY BUNDLE/0803***4521", amount: 9500, channel: "bill_payment" },
        { day: 28, narration: "DSTV COMPACT/SUBSCRIPTION/7024***118", amount: 15700, channel: "bill_payment" },
        { day: 28, narration: "NIP TRF TO NGOZI OKAFOR/UPKEEP FOR MUMMY", amount: 30000, channel: "transfer" },
      ],
      spendTarget: [285000, 275000, 280000, 290000, 270000, 280000],
      discretionary: [
        { narration: "POS/SHOPRITE LEKKI/LA NG", channel: "pos", min: 8000, max: 25000, weight: 3 },
        { narration: "POS/BUKKA HUT ADMIRALTY/LA NG", channel: "pos", min: 3500, max: 9000, weight: 3 },
        { narration: "WEB/BOLT.EU/RIDE LAGOS", channel: "web", min: 2500, max: 6000, weight: 4 },
        { narration: "WEB/CHOWDECK/ORDER", channel: "web", min: 4000, max: 9000, weight: 3 },
        { narration: "WEB/JUMIA.COM.NG", channel: "web", min: 6000, max: 20000, weight: 1 },
        { narration: "POS/FILMHOUSE LEKKI/LA NG", channel: "pos", min: 5000, max: 8000, weight: 1 },
        { narration: "ATM WDL/ZENITH ATM ADMIRALTY WAY", channel: "atm", min: 10000, max: 20000, weight: 1 },
      ],
      recent: [
        { day: 1, narration: "POS/SHOPRITE LEKKI/LA NG", amount: 23400, channel: "pos" },
        { day: 3, narration: "WEB/BOLT.EU/RIDE LAGOS", amount: 3500, channel: "web" },
        { day: 5, narration: "WEB/CHOWDECK/ORDER", amount: 6500, channel: "web" },
        { day: 7, narration: "POS/BUKKA HUT ADMIRALTY/LA NG", amount: 8900, channel: "pos" },
      ],
    },
  },
  CUST_DANIEL: {
    openingBalance: 15000,
    plan: {
      seed: 21,
      credits: (i, mon) => [
        { day: 1, narration: `NIP TRF FROM EZE CHUKWUEMEKA/${mon} ALLOWANCE`, amount: 70000, channel: "transfer" },
        {
          day: 12 + i,
          narration: ["NIP TRF FROM TOBI ADEWALE/LOGO DESIGN", "", "NIP TRF FROM FUNKE PRINTS/FLYER DESIGN", "NIP TRF FROM KEMI A./BIRTHDAY GIFT", "NIP TRF FROM LAGOS TECH HUB/UI DESIGN GIG", "NIP TRF FROM TOBI ADEWALE/LOGO DESIGN"][i],
          amount: [15000, 0, 25000, 2000, 40000, 12000][i],
          channel: "transfer",
        },
      ],
      fixed: (i) => [
        { day: 3, narration: "AIRTEL DATA/6GB BUNDLE/0812***7744", amount: 2000, channel: "bill_payment" },
        { day: 18, narration: "AIRTEL DATA/6GB BUNDLE/0812***7744", amount: 2000, channel: "bill_payment" },
        { day: 2, narration: "WEB/BRT COWRY CARD TOPUP", amount: 2000, channel: "web" },
        { day: 16, narration: "WEB/BRT COWRY CARD TOPUP", amount: 2000, channel: "web" },
        ...(i === 0 ? [{ day: 9, narration: "REMITA/UNILAG/HOSTEL ACCOMMODATION 2025-26", amount: 45000, channel: "bill_payment" as Channel }] : []),
        ...(i === 5 ? [{ day: 16, narration: "REMITA/UNILAG/DEPARTMENTAL & FACULTY DUES", amount: 25000, channel: "bill_payment" as Channel }] : []),
      ],
      spendTarget: [80000, 68000, 90000, 71000, 101000, 78000],
      discretionary: [
        { narration: "POS/FACULTY OF SCIENCE CAFETERIA/AKOKA LA NG", channel: "pos", min: 1200, max: 3000, weight: 6 },
        { narration: "POS/MAMA PUT YABA/LA NG", channel: "pos", min: 1000, max: 2500, weight: 3 },
        { narration: "WEB/CHOWDECK/ORDER", channel: "web", min: 3000, max: 7000, weight: 2 },
        { narration: "POS/PRINTING & BINDING/AKOKA LA NG", channel: "pos", min: 500, max: 3500, weight: 2 },
        { narration: "WEB/JUMIA.COM.NG", channel: "web", min: 3000, max: 9000, weight: 1 },
        { narration: "ATM WDL/ZENITH ATM UNILAG", channel: "atm", min: 2000, max: 5000, weight: 1 },
      ],
      recent: [
        { day: 1, narration: "NIP TRF FROM EZE CHUKWUEMEKA/OCT ALLOWANCE", amount: 70000, channel: "transfer" },
        { day: 3, narration: "POS/PRINTING & BINDING/AKOKA LA NG", amount: 3500, channel: "pos" },
        { day: 3, narration: "AIRTEL DATA/6GB BUNDLE/0812***7744", amount: 2000, channel: "bill_payment" },
        { day: 6, narration: "WEB/JUMIA.COM.NG", amount: 5000, channel: "web" },
        { day: 7, narration: "POS/FACULTY OF SCIENCE CAFETERIA/AKOKA LA NG", amount: 1800, channel: "pos" },
      ],
    },
  },
  CUST_TOLU: {
    openingBalance: 600000,
    plan: {
      seed: 35,
      credits: (i, mon) => [
        { day: 27, narration: `NIP/OKONKWO & PARTNERS/SALARY ${mon} ${YEAR}`, amount: [780000, 780000, 780000, 785000, 780000, 780000][i], channel: "transfer" },
      ],
      savings: () => [{ day: 28, narration: "SAVE4ME/AUTO-SAVE/CHILDREN'S EDUCATION", amount: 150000, channel: "standing_order" }],
      fixed: (i) => [
        { day: 1, narration: "NIP TRF TO BLESSING OKON/HOUSEKEEPING", amount: 60000, channel: "transfer" },
        { day: 3, narration: "ZENITH CREDIT CARD/REPAYMENT FULL BALANCE", amount: [112400, 118400, 109800, 121000, 115300, 118400][i], channel: "transfer" },
        { day: 28, narration: "NIP TRF TO GREENSPRINGS SCHOOL/FEES INSTALMENT", amount: 180000, channel: "transfer" },
        { day: 29, narration: "IKEJA ELECTRIC/POSTPAID/ACCT 0451***", amount: 32000, channel: "bill_payment" },
        { day: 29, narration: "GLO DATA/40GB BUNDLE/0805***9020", amount: 11000, channel: "bill_payment" },
      ],
      spendTarget: [520000, 515000, 530000, 525000, 510000, 520000],
      discretionary: [
        { narration: "POS/SPAR IKEJA CITY MALL/LA NG", channel: "pos", min: 15000, max: 45000, weight: 3 },
        { narration: "WEB/UBER/TRIP LAGOS", channel: "web", min: 3000, max: 7000, weight: 3 },
        { narration: "POS/CHICKEN REPUBLIC ALLEN/LA NG", channel: "pos", min: 3000, max: 8000, weight: 2 },
        { narration: "WEB/KONGA.COM", channel: "web", min: 10000, max: 30000, weight: 1 },
        { narration: "ATM WDL/ZENITH ATM ALLEN AVENUE", channel: "atm", min: 20000, max: 40000, weight: 1 },
      ],
      recent: [
        { day: 1, narration: "NIP TRF TO BLESSING OKON/HOUSEKEEPING", amount: 60000, channel: "transfer" },
        { day: 1, narration: "POS/SPAR IKEJA CITY MALL/LA NG", amount: 41300, channel: "pos" },
        { day: 3, narration: "ZENITH CREDIT CARD/REPAYMENT FULL BALANCE", amount: 118400, channel: "transfer" },
        { day: 5, narration: "WEB/UBER/TRIP LAGOS", amount: 5200, channel: "web" },
      ],
    },
  },
};

export function openingBalance(customerId: string): number {
  return PLANS[customerId]?.openingBalance ?? 0;
}

/** The full raw statement for a demo customer, oldest first. */
export function buildLedger(customerId: string): RawTransaction[] {
  const p = PLANS[customerId];
  return p ? generate(customerId, p.plan) : [];
}
