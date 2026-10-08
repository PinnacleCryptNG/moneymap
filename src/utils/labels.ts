import {
  Briefcase,
  Compass,
  CreditCard,
  GraduationCap,
  HandCoins,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import type { ExpenseKind, FeedbackType, GoalType, ProductCategory } from "../types";

export const CATEGORY_META: Record<ProductCategory, { label: string; icon: LucideIcon }> = {
  savings: { label: "Savings", icon: PiggyBank },
  accounts: { label: "Accounts", icon: GraduationCap },
  financing: { label: "Loans & financing", icon: HandCoins },
  cards: { label: "Cards", icon: CreditCard },
};

export const GOAL_META: Record<GoalType, { label: string; icon: LucideIcon; hint: string; needsAmount: boolean }> = {
  save_more: { label: "Save more", icon: PiggyBank, hint: "Put money aside for something specific", needsAmount: true },
  grow_money: { label: "Grow my money", icon: TrendingUp, hint: "Make money left over work harder", needsAmount: false },
  major_expense: { label: "Fund a major expense", icon: HandCoins, hint: "Rent, school fees, a wedding, a car…", needsAmount: true },
  everyday: { label: "Manage my everyday money", icon: Wallet, hint: "Smoother payments and spending", needsAmount: false },
  grow_business: { label: "Grow my business", icon: Briefcase, hint: "Banking that keeps up with your business", needsAmount: false },
  protect: { label: "Protect my finances", icon: ShieldCheck, hint: "Be ready for the unexpected", needsAmount: false },
  not_sure: { label: "I'm not sure yet", icon: Compass, hint: "Let MoneyMap look at your situation first", needsAmount: false },
};

export const GOAL_ORDER: GoalType[] = [
  "save_more",
  "major_expense",
  "everyday",
  "grow_money",
  "grow_business",
  "protect",
  "not_sure",
];

export const EXPENSE_KINDS: { value: ExpenseKind; label: string; goalLabel: string }[] = [
  { value: "rent", label: "Rent", goalLabel: "Pay my rent" },
  { value: "school_fees", label: "School fees", goalLabel: "Pay school fees" },
  { value: "wedding", label: "Wedding / introduction", goalLabel: "Fund my wedding" },
  { value: "vehicle", label: "Buy a car", goalLabel: "Buy a car" },
  { value: "equipment", label: "Equipment or machinery", goalLabel: "Buy equipment" },
  { value: "other", label: "Something else", goalLabel: "Major expense" },
];

export const FEEDBACK_LABELS: Record<FeedbackType, string> = {
  useful: "Useful",
  not_relevant: "Not relevant",
  not_understood: "I don't understand",
  not_wanted: "I don't want this",
  remind_later: "Remind me later",
};

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
