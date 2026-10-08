// Consent enforcement point: data a customer hasn't permitted never reaches the decision engine.
// The engine also gates every signal on permissions — this is the second, independent layer.
import type { CustomerProfile, Permissions } from "../src/types";

export function redactProfile(c: CustomerProfile, p: Permissions): CustomerProfile {
  const zeros = c.monthlyIncome.map(() => 0);
  return {
    ...c,
    monthlyIncome: p.income_patterns ? c.monthlyIncome : zeros,
    incomeDay: p.income_patterns ? c.incomeDay : 0,
    monthlySpending: p.spending_patterns ? c.monthlySpending : zeros,
    recurringCommitments: p.spending_patterns ? c.recurringCommitments : 0,
    averageBalance: p.account_activity ? c.averageBalance : 0,
    savingMonths: p.account_activity ? c.savingMonths : 0,
    digitalShare: p.account_activity ? c.digitalShare : 0,
    cardSpendShare: p.account_activity ? c.cardSpendShare : 0,
    schoolPayments: p.account_activity ? c.schoolPayments : false,
    // Money in is income data; everything else in the feed is account activity.
    transactions: c.transactions.filter((t) => (t.direction === "in" ? p.income_patterns : p.account_activity)),
    existingProducts: p.existing_products ? c.existingProducts : [],
    derivation: c.derivation && {
      ...c.derivation,
      income: p.income_patterns ? c.derivation.income : null,
      spending: p.spending_patterns ? c.derivation.spending : null,
      activity: p.account_activity ? c.derivation.activity : null,
    },
  };
}

/** What the customer's own profile endpoint may return. */
export function publicProfile(c: CustomerProfile, p: Permissions) {
  return {
    id: c.id,
    name: c.name,
    first_name: c.firstName,
    age: c.age,
    segment: c.segment,
    occupation: c.occupation,
    city: c.city,
    existing_products: p.existing_products ? c.existingProducts : null,
    recent_transactions: p.account_activity ? c.transactions : null,
  };
}
