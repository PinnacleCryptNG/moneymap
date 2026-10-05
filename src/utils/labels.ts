import {
  Briefcase,
  CreditCard,
  HandCoins,
  PiggyBank,
  ShieldCheck,
  TrendingUp,
  Wallet,
  Compass,
  type LucideIcon,
} from "lucide-react";
import type { GoalType, ProductCategory } from "../types";

export const CATEGORY_META: Record<ProductCategory, { label: string; icon: LucideIcon }> = {
  savings: { label: "Savings", icon: PiggyBank },
  investments: { label: "Investments", icon: TrendingUp },
  financing: { label: "Financing", icon: HandCoins },
  business: { label: "Business banking", icon: Briefcase },
  cards: { label: "Cards", icon: CreditCard },
  other: { label: "Other financial services", icon: ShieldCheck },
};

export const GOAL_META: Record<GoalType, { label: string; icon: LucideIcon; hint: string; needsAmount: boolean }> = {
  save_more: { label: "Save more", icon: PiggyBank, hint: "Put money aside for something specific", needsAmount: true },
  grow_money: { label: "Grow my money", icon: TrendingUp, hint: "Make surplus money work harder", needsAmount: true },
  major_expense: { label: "Fund a major expense", icon: HandCoins, hint: "Rent, school fees, a car, a wedding…", needsAmount: true },
  everyday: { label: "Manage my everyday money", icon: Wallet, hint: "Smoother payments and spending", needsAmount: false },
  grow_business: { label: "Grow my business", icon: Briefcase, hint: "Banking that keeps up with your business", needsAmount: false },
  protect: { label: "Protect my finances", icon: ShieldCheck, hint: "Be ready for the unexpected", needsAmount: false },
  not_sure: { label: "I'm not sure yet", icon: Compass, hint: "Let MoneyMap look at your context first", needsAmount: false },
};

export const GOAL_ORDER: GoalType[] = [
  "save_more",
  "grow_money",
  "major_expense",
  "everyday",
  "grow_business",
  "protect",
  "not_sure",
];

export const FEEDBACK_LABELS = {
  useful: "This was useful",
  not_relevant: "Not relevant",
  dont_understand: "I don't understand",
  dont_want: "I don't want this",
  remind_later: "Remind me later",
} as const;
