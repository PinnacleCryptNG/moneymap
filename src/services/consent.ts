import type { PermissionKey } from "../types";

/** Plain-language consent copy (spec §41). */
export const PERMISSION_COPY: Record<PermissionKey, { title: string; use: string; why: string }> = {
  account_activity: {
    title: "Account activity",
    use: "Used to see your balance, how often you use your account and how you put money aside.",
    why: "Helps us spot when money is sitting idle or when your banking needs have changed.",
  },
  income_patterns: {
    title: "Income patterns",
    use: "Used to see when money comes in and how much.",
    why: "Shows whether your income is steady or changing, so suggestions fit what you can afford.",
  },
  spending_patterns: {
    title: "Spending patterns",
    use: "Used to see your regular bills and where your money goes.",
    why: "Lets us work out what you have left after your usual spending.",
  },
  existing_products: {
    title: "Existing Zenith products",
    use: "Used to see which products you already have.",
    why: "Stops us suggesting something you already hold, or something that overlaps.",
  },
  financial_goals: {
    title: "Financial goals",
    use: "Used to match products to what you are trying to achieve.",
    why: "Your goal is the starting point — products come after the need.",
  },
};

export const PERMISSION_ORDER: PermissionKey[] = [
  "account_activity",
  "income_patterns",
  "spending_patterns",
  "existing_products",
  "financial_goals",
];
