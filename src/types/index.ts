// Core domain types for MoneyMap.

export type GoalType =
  | "save_more"
  | "grow_money"
  | "major_expense"
  | "everyday"
  | "grow_business"
  | "protect"
  | "not_sure";

export type PermissionKey =
  | "account_activity"
  | "income_patterns"
  | "spending_patterns"
  | "existing_products"
  | "financial_goals";

export type Permissions = Record<PermissionKey, boolean>;

export type ProductCategory =
  | "savings"
  | "investments"
  | "financing"
  | "business"
  | "cards"
  | "other";

export type FinancialNeed =
  | "goal_saving"
  | "surplus_management"
  | "emergency_fund"
  | "wealth_growth"
  | "expense_financing"
  | "business_banking"
  | "everyday_banking"
  | "financial_protection";

/** Behavioural / contextual signals the engine can detect. */
export type Signal =
  | "consistent_income"
  | "irregular_income"
  | "income_increase"
  | "regular_surplus"
  | "low_surplus"
  | "stated_savings_goal"
  | "savings_in_everyday_account"
  | "repeated_saving_behaviour"
  | "planned_major_expense"
  | "business_inflows"
  | "business_growth"
  | "high_transaction_volume"
  | "high_card_spend"
  | "no_emergency_buffer"
  | "needs_immediate_liquidity"
  | "large_idle_balance";

export type CustomerSegment = "student" | "retail" | "business";

export type ExistingProductId =
  | "current_account"
  | "savings_account"
  | "debit_card"
  | "credit_card"
  | "personal_loan"
  | "business_account"
  | "fixed_deposit"
  | "investment_fund";

/** Synthetic customer record (anonymised prototype data). */
export interface CustomerProfile {
  id: string;
  name: string;
  firstName: string;
  age: number;
  segment: CustomerSegment;
  persona: string;
  story: string;
  /** Last 6 months, oldest first (₦). */
  monthlyIncome: number[];
  /** Last 6 months, oldest first (₦). */
  monthlySpending: number[];
  /** Fixed recurring commitments per month (₦), included in spending. */
  recurringCommitments: number;
  averageBalance: number;
  /** Count of transactions per month, last 6 months. */
  transactionsPerMonth: number[];
  /** Number of months in the last 6 with a deliberate transfer-to-self / set-aside pattern. */
  savingMonths: number;
  /** Business-related inflows per month (₦), last 6 months. */
  businessInflows?: number[];
  cardSpendShare: number;
  existingProducts: ExistingProductId[];
  defaultGoal?: GoalDraft;
}

export interface GoalDraft {
  type: GoalType;
  label: string;
  amount: number;
  timelineMonths: number;
  saved?: number;
}

export interface FinancialGoal extends GoalDraft {
  id: string;
  saved: number;
  createdAt: string;
}

export interface ProductEligibility {
  minimum_income: number | null;
  minimum_age: number;
  account_required: boolean;
  minimum_balance?: number | null;
  /** Monthly repayment must not exceed this share of income (financing only). */
  max_repayment_to_income?: number | null;
}

export interface Product {
  product_id: string;
  name: string;
  category: ProductCategory;
  purpose: string;
  description: string;
  target_customer: CustomerSegment[];
  eligibility: ProductEligibility;
  financial_needs: FinancialNeed[];
  recommended_when: Signal[];
  not_recommended_when: Signal[];
  /** Holding period this product suits best, in months. */
  horizon_months?: { min?: number; max?: number };
  /** Existing holding that makes this product redundant. */
  equivalent_holding?: ExistingProductId;
  key_terms: string[];
  fees: string;
  required_documents: string[];
  application_route: "digital" | "branch" | "relationship_manager";
  status: "active" | "inactive";
  version: number;
  updated_at: string;
}

export type FeedbackType =
  | "useful"
  | "not_relevant"
  | "dont_understand"
  | "dont_want"
  | "remind_later";

export type Frequency = "highly_relevant" | "occasionally" | "auto";

export interface Preferences {
  categories: Record<ProductCategory, boolean>;
  frequency: Frequency;
}

export interface ConsentRecord {
  id: string;
  permission: PermissionKey | "all";
  granted: boolean;
  at: string;
}

export type RecommendationStatus =
  | "recommended"
  | "viewed"
  | "explored"
  | "applied"
  | "dismissed"
  | "snoozed";

export interface RecommendationRecord {
  id: string;
  productId: string;
  productName: string;
  category: ProductCategory;
  score: number;
  createdAt: string;
  status: RecommendationStatus;
  feedback?: FeedbackType;
  feedbackAt?: string;
  snoozedUntil?: string;
}

export interface Application {
  id: string;
  productId: string;
  productName: string;
  at: string;
  status: "submitted";
}

export interface AuditEntry {
  id: string;
  at: string;
  actor: "customer" | "admin" | "system";
  action: string;
  detail: string;
}
