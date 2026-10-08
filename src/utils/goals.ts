// Goal input validation shared by the app and the API.
/** Validation limits for goal inputs. */
export const GOAL_LIMITS = { minAmount: 10_000, maxAmount: 1_000_000_000, minMonths: 1, maxMonths: 120 } as const;

export function goalInputError(amount: number, months: number, needsAmount: boolean): string | null {
  if (needsAmount) {
    if (!amount) return "Enter a target amount.";
    if (amount < GOAL_LIMITS.minAmount) return "Enter at least ₦10,000.";
    if (amount > GOAL_LIMITS.maxAmount) return "That amount is too large for this prototype — enter up to ₦1,000,000,000.";
  }
  if (!months || months < GOAL_LIMITS.minMonths) return "Enter a timeline of at least 1 month.";
  if (months > GOAL_LIMITS.maxMonths) return "Enter a timeline of 120 months (10 years) or less.";
  return null;
}
