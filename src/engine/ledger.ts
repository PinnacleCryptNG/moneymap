// Stage 0 — READ THE ACCOUNT: turn a raw bank statement into the figures the engine uses.
// The categoriser works from the narration text and channel only, exactly as a statement line arrives.
import type { CustomerProfile, Derivation, PersonaBase, RawTransaction, Transaction, TxCategory } from "../types";

// ---------------- Categoriser ----------------

const INCOME_CATEGORIES: TxCategory[] = ["salary", "allowance", "side_income", "other_income"];
const COMMITMENT_CATEGORIES: TxCategory[] = ["rent", "utilities", "subscriptions", "airtime_data", "transport", "education", "family_support", "debt_repayment"];

/** Ordered rules: the first match wins. */
const DEBIT_RULES: [RegExp, TxCategory][] = [
  [/SAVE4ME|AUTO-?SAVE|TARGET SAVINGS|PIGGYVEST|COWRYWISE|\bAJO\b|ESUSU|THRIFT|TO SAVINGS/, "savings"],
  [/\bRENT\b/, "rent"],
  [/CREDIT CARD|LOAN REPAYMENT|REPAYMENT/, "debt_repayment"],
  [/UNILAG|UNIVERSITY|POLYTECHNIC|SCHOOL|TUITION|\bFEES\b|PRINTING|BOOKSHOP|REMITA\/[A-Z]+\/.*(DUES|ACCOMMODATION)/, "education"],
  [/IKEDC|EKEDC|IKEJA ELECTRIC|\bAEDC\b|\bPHED\b|ELECTRIC|LAWMA|WATER CORP/, "utilities"],
  [/DSTV|GOTV|SHOWMAX|NETFLIX|SPOTIFY|STARTIMES/, "subscriptions"],
  [/\bMTN\b|AIRTEL|\bGLO\b|9MOBILE|\bDATA\b|AIRTIME/, "airtime_data"],
  [/BOLT|UBER|\bBRT\b|COWRY|INDRIVE|\bKEKE\b|TOTALENERGIES|\bNNPC\b|\bFUEL\b/, "transport"],
  [/SHOPRITE|\bSPAR\b|CHOWDECK|GLOVO|BUKKA|CAFETERIA|CHICKEN REPUBLIC|\bKFC\b|DOMINO|MAMA PUT|RESTAURANT|EATERY/, "food"],
  [/JUMIA|KONGA|ALIEXPRESS|\bMALL\b|FILMHOUSE|CINEMA|STORE/, "shopping"],
  [/UPKEEP|MUMMY|\bMUM\b|\bDAD\b|FAMILY|HOUSEKEEPING/, "family_support"],
  [/ATM WDL|ATM WITHDRAWAL|\bCASH\b/, "cash"],
];

export function categorise(t: Pick<RawTransaction, "narration" | "direction" | "channel">): TxCategory {
  const n = t.narration.toUpperCase();
  if (t.direction === "credit") {
    if (/SALARY|PAYROLL/.test(n)) return "salary";
    if (/ALLOWANCE|POCKET MONEY|UPKEEP FROM/.test(n)) return "allowance";
    if (/NIP TRF FROM|TRANSFER FROM|TRF FRM/.test(n)) return "side_income";
    return "other_income";
  }
  if (t.channel === "atm") return "cash";
  for (const [re, cat] of DEBIT_RULES) if (re.test(n)) return cat;
  return "other";
}

const SMALL_WORDS = new Set(["&", "OF", "AND", "TO", "FOR"]);
const KEEP_UPPER = new Set(["IKEDC", "EKEDC", "MTN", "GLO", "BRT", "KFC", "NNPC", "ATM", "POS", "UNILAG", "LTD", "UI", "LA", "NG"]);
const SPECIAL: Record<string, string> = { DSTV: "DStv", GOTV: "GOtv" };
function titleCase(s: string) {
  return s
    .trim()
    .split(/\s+/)
    .map((w) =>
      SMALL_WORDS.has(w)
        ? w.toLowerCase()
        : SPECIAL[w]
          ? SPECIAL[w]
          : KEEP_UPPER.has(w) || /\d/.test(w) || w.includes("***")
            ? w === "LTD" ? "Ltd" : w
            : w.charAt(0) + w.slice(1).toLowerCase(),
    )
    .join(" ")
    .replace(/^./, (c) => c.toUpperCase());
}

/** A readable description from a bank narration, e.g. "POS/SHOPRITE LEKKI/LA NG" → "Card payment — Shoprite Lekki". */
export function describe(t: Pick<RawTransaction, "narration" | "direction">): string {
  const parts = t.narration.split("/").map((p) => p.trim()).filter(Boolean);
  const head = parts[0]?.toUpperCase() ?? "";
  if (head.startsWith("NIP TRF FROM")) return `Transfer from ${titleCase(head.replace("NIP TRF FROM", ""))}${parts[1] ? ` — ${titleCase(parts[1]).toLowerCase()}` : ""}`;
  if (head.startsWith("NIP TRF TO")) return `Transfer to ${titleCase(head.replace("NIP TRF TO", ""))}${parts[1] ? ` — ${titleCase(parts[1]).toLowerCase()}` : ""}`;
  if (head === "NIP" && /SALARY/.test(parts[2] ?? "")) return `Salary — ${titleCase(parts[1])}`;
  if (head === "NIP" && parts[1] && parts[2]) return `${titleCase(parts[2]).toLowerCase().replace(/^./, (c) => c.toUpperCase())} — ${titleCase(parts[1])}`;
  if (head === "POS") return `Card payment — ${titleCase(parts[1] ?? "")}`;
  if (head === "WEB") return `Online payment — ${titleCase(parts[1] ?? "")}`;
  if (head === "ATM WDL") return `Cash withdrawal — ${titleCase(parts[1] ?? "")}`;
  if (head === "REMITA") return `${titleCase(parts[1] ?? "")} — ${titleCase(parts[2] ?? "").toLowerCase()}`;
  return parts.length > 1 ? `${titleCase(parts[0])} — ${titleCase(parts[1]).toLowerCase()}` : titleCase(parts[0] ?? t.narration);
}

/** Key for spotting the same payment recurring: the narration without numbers and month names. */
function recurrenceKey(narration: string) {
  return narration
    .toUpperCase()
    .replace(/\b(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\b/g, "")
    .replace(/[\d*]+/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ---------------- Derivation ----------------

const DAY = 86_400_000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : 0;
};

export interface DeriveOptions {
  /** The demo's "today"; months analysed are the six complete calendar months before it. */
  today: string;
  openingBalance: number;
}

/** Derive the customer's financial profile from their raw ledger. */
export function deriveProfile(base: PersonaBase, ledger: RawTransaction[], opts: DeriveOptions): CustomerProfile {
  const today = new Date(`${opts.today}T00:00:00Z`);
  const months: string[] = [];
  for (let k = 6; k >= 1; k--) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - k, 1));
    months.push(d.toISOString().slice(0, 7));
  }
  const rows = ledger.map((t) => ({ ...t, category: categorise(t), month: t.date.slice(0, 7) }));
  const inWindow = rows.filter((t) => months.includes(t.month));
  const byMonth = (pred: (t: (typeof rows)[number]) => boolean) =>
    months.map((m) => inWindow.filter((t) => t.month === m && pred(t)).reduce((a, t) => a + t.amount, 0));

  const isIncome = (t: (typeof rows)[number]) => t.direction === "credit" && INCOME_CATEGORIES.includes(t.category);
  const isSpend = (t: (typeof rows)[number]) => t.direction === "debit" && t.category !== "savings";
  const monthlyIncome = byMonth(isIncome);
  const monthlySpending = byMonth(isSpend);
  const monthlySavings = byMonth((t) => t.direction === "debit" && t.category === "savings");

  // Main income: salary if it arrives most months, else allowance, else mixed.
  const salaryMonths = new Set(inWindow.filter((t) => t.category === "salary").map((t) => t.month)).size;
  const allowanceMonths = new Set(inWindow.filter((t) => t.category === "allowance").map((t) => t.month)).size;
  const incomeSource: CustomerProfile["incomeSource"] = salaryMonths >= 4 ? "salary" : allowanceMonths >= 4 ? "allowance" : "mixed";
  const mainCredits = inWindow.filter((t) => t.category === (incomeSource === "allowance" ? "allowance" : "salary"));
  const incomeDay = median(mainCredits.map((t) => Number(t.date.slice(8, 10)))) || 1;
  const employer = inWindow.find((t) => t.category === "salary")?.narration.split("/")[1];

  // Recurring commitments: the same bill-like payment in at least 5 of the 6 months, at a steady amount.
  // Everyday spending (food, shopping, cash) can be regular without being a commitment.
  const groups = new Map<string, (typeof rows)[number][]>();
  for (const t of inWindow.filter((x) => isSpend(x) && COMMITMENT_CATEGORIES.includes(x.category))) {
    const k = recurrenceKey(t.narration);
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const recurring: { label: string; monthlyAverage: number }[] = [];
  for (const [, ts] of groups) {
    const perMonth = months.map((m) => ts.filter((t) => t.month === m).reduce((a, t) => a + t.amount, 0));
    const active = perMonth.filter((x) => x > 0);
    if (active.length < 5) continue;
    const avg = mean(active);
    const cv = Math.sqrt(mean(active.map((x) => (x - avg) ** 2))) / avg;
    if (cv <= 0.25) recurring.push({ label: describe(ts[0]), monthlyAverage: Math.round(mean(perMonth)) });
  }
  recurring.sort((a, b) => b.monthlyAverage - a.monthlyAverage);
  const recurringCommitments = recurring.reduce((a, r) => a + r.monthlyAverage, 0);

  // End-of-day balances across the analysed months.
  const start = new Date(`${months[0]}-01T00:00:00Z`).getTime();
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)).getTime();
  let balance = opts.openingBalance;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  let idx = 0;
  while (idx < sorted.length && new Date(`${sorted[idx].date}T00:00:00Z`).getTime() < start) {
    balance += sorted[idx].direction === "credit" ? sorted[idx].amount : -sorted[idx].amount;
    idx++;
  }
  const daily: number[] = [];
  for (let day = start; day < end; day += DAY) {
    while (idx < sorted.length && new Date(`${sorted[idx].date}T00:00:00Z`).getTime() <= day) {
      balance += sorted[idx].direction === "credit" ? sorted[idx].amount : -sorted[idx].amount;
      idx++;
    }
    daily.push(balance);
  }
  const averageBalance = Math.round(mean(daily));

  // Saving: a transfer into savings, or at least 15% of income left unspent.
  const savingMonths = months.filter((_, i) => monthlySavings[i] > 0 || monthlyIncome[i] - monthlySpending[i] >= 0.15 * monthlyIncome[i]).length;

  const spendRows = inWindow.filter(isSpend);
  const totalSpend = spendRows.reduce((a, t) => a + t.amount, 0) || 1;
  const cash = spendRows.filter((t) => t.category === "cash").reduce((a, t) => a + t.amount, 0);
  // Card spending includes paying off a credit card, since those purchases happened by card.
  const card = spendRows
    .filter((t) => t.channel === "pos" || t.channel === "web" || (t.category === "debt_repayment" && /CREDIT CARD/.test(t.narration.toUpperCase())))
    .reduce((a, t) => a + t.amount, 0);
  const education = inWindow.filter((t) => t.category === "education");

  const byCategory = [...new Set(spendRows.map((t) => t.category))]
    .map((category) => {
      const sum = spendRows.filter((t) => t.category === category).reduce((a, t) => a + t.amount, 0);
      return { category, monthlyAverage: Math.round(sum / months.length), share: sum / totalSpend };
    })
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);
  const incomeSources = [...new Set(inWindow.filter(isIncome).map((t) => t.category))]
    .map((category) => ({
      category,
      monthlyAverage: Math.round(inWindow.filter((t) => isIncome(t) && t.category === category).reduce((a, t) => a + t.amount, 0) / months.length),
    }))
    .sort((a, b) => b.monthlyAverage - a.monthlyAverage);
  const savingsRow = inWindow.find((t) => t.category === "savings");

  const derivation: Derivation = {
    months,
    transactionCount: inWindow.length,
    income: { employer: employer ? titleCase(employer) : undefined, mainCreditCount: mainCredits.length, sources: incomeSources },
    spending: { byCategory, recurring },
    activity: {
      savingsTransfersMonthly: Math.round(mean(monthlySavings)),
      savingsDestination: savingsRow ? describe(savingsRow).split(" — ")[0] : undefined,
      schoolDescription: education[0] ? describe(education[0]) : undefined,
      cashShare: cash / totalSpend,
    },
  };

  const todayMs = today.getTime();
  const transactions: Transaction[] = [...rows]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 12)
    .map((t) => ({
      daysAgo: Math.max(0, Math.round((todayMs - new Date(`${t.date}T00:00:00Z`).getTime()) / DAY)),
      description: describe(t),
      narration: t.narration,
      amount: t.amount,
      direction: t.direction === "credit" ? "in" : "out",
      category: t.category,
      channel: t.channel,
    }));

  return {
    ...base,
    monthlyIncome,
    incomeSource,
    incomeDay,
    monthlySpending,
    recurringCommitments,
    averageBalance,
    savingMonths,
    digitalShare: 1 - cash / totalSpend,
    cardSpendShare: card / totalSpend,
    schoolPayments: education.length > 0,
    transactions,
    derivation,
  };
}

export const CATEGORY_LABELS: Record<TxCategory, string> = {
  salary: "Salary",
  allowance: "Allowance",
  side_income: "Other transfers in",
  other_income: "Other income",
  rent: "Rent",
  utilities: "Electricity & utilities",
  subscriptions: "TV & subscriptions",
  airtime_data: "Airtime & data",
  transport: "Transport",
  food: "Food & groceries",
  shopping: "Shopping & leisure",
  education: "School & education",
  family_support: "Family & household",
  debt_repayment: "Card & loan repayments",
  savings: "Savings",
  cash: "Cash withdrawals",
  other: "Other",
};
