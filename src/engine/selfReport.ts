// The customer's own answers about their money. Used wherever their statement isn't shared (or shows nothing),
// so a customer who prefers to tell MoneyMap rather than show it still gets a useful map.
import type { Amount, CustomerProfile, Permissions, SelfReport } from "../types";

const MONTHS = 6;

/** Midpoint used for planning; null when the customer isn't sure. */
export function mid(a: Amount): number | null {
  return a.kind === "exact" ? a.value : a.kind === "range" ? Math.round((a.min + a.max) / 2) : null;
}

/** Low and high ends of an answer; an exact figure is both. */
function ends(a: Amount): [number, number] | null {
  return a.kind === "exact" ? [a.value, a.value] : a.kind === "range" ? [a.min, a.max] : null;
}

/**
 * Six months of figures from one answer per source. Ranges alternate between their two ends, so a
 * "₦50,000–₦150,000" business shows up as income that varies — and `lowFirst` lets spending take its high
 * end in the months income takes its low end, so the plan never assumes the best case.
 */
function series(answers: Amount[], lowFirst: boolean): number[] | null {
  const known = answers.map(ends).filter((x): x is [number, number] => x !== null);
  if (!known.length) return null;
  return Array.from({ length: MONTHS }, (_, i) =>
    known.reduce((sum, [lo, hi]) => sum + ((i % 2 === 0) === lowFirst ? lo : hi), 0),
  );
}

const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);

/** Bills that come round every month whatever happens; counted as fixed commitments. */
export const FIXED_EXPENSES = new Set(["Rent", "Electricity", "School fees", "Airtime & data", "Transport", "Family support", "Loan repayment"]);

export function reportedIncome(r: SelfReport): number[] | null {
  return series([...(r.fixedIncome ? [r.fixedIncome] : []), ...r.variableIncome.map((v) => v.amount)], true);
}

export function reportedSpending(r: SelfReport): number[] | null {
  if (r.expenses.mode === "unsure") return null;
  return series(r.expenses.mode === "total" ? [r.expenses.total] : r.expenses.items.map((i) => i.amount), false);
}

/** Money in personal and savings accounts — what's available day to day. Business and investments aren't counted. */
export function reportedBalance(r: SelfReport): number | null {
  const liquid = r.accounts.filter((a) => a.kind === "personal" || a.kind === "savings").map((a) => mid(a.amount));
  const known = liquid.filter((x): x is number => x !== null);
  return known.length ? known.reduce((a, b) => a + b, 0) : null;
}

/** Fill the parts of the profile the statement doesn't provide with the customer's answers. */
export function applySelfReport(c: CustomerProfile, r: SelfReport | null | undefined, p: Permissions): CustomerProfile {
  if (!r) return c;
  const out: CustomerProfile = { ...c, reported: { income: false, spending: false, balance: false } };

  const income = reportedIncome(r);
  if (income && (!p.income_patterns || avg(c.monthlyIncome) === 0)) {
    out.monthlyIncome = income;
    out.incomeSource = r.variableIncome.some((v) => v.amount.kind !== "unsure") ? "mixed" : "salary";
    out.incomeDay = 0;
    out.reported!.income = true;
  }

  const spending = reportedSpending(r);
  if (spending && (!p.spending_patterns || avg(c.monthlySpending) === 0)) {
    out.monthlySpending = spending;
    out.recurringCommitments =
      r.expenses.mode === "itemised"
        ? r.expenses.items.filter((i) => FIXED_EXPENSES.has(i.category)).reduce((a, i) => a + (mid(i.amount) ?? 0), 0)
        : 0;
    out.reported!.spending = true;
  }

  const balance = reportedBalance(r);
  if (balance !== null && !p.account_activity) {
    out.averageBalance = balance;
    out.reported!.balance = true;
  }
  return out;
}
