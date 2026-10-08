// Core domain types for MoneyMap.

export type GoalType =
  | "save_more"
  | "grow_money"
  | "major_expense"
  | "everyday"
  | "grow_business"
  | "protect"
  | "not_sure";

/** What a major expense is for. An asset (car, equipment) points to asset finance. */
export type ExpenseKind = "rent" | "school_fees" | "wedding" | "vehicle" | "equipment" | "other";

export type PermissionKey =
  | "account_activity"
  | "income_patterns"
  | "spending_patterns"
  | "existing_products"
  | "financial_goals";

export type Permissions = Record<PermissionKey, boolean>;

export type ProductCategory = "savings" | "accounts" | "financing" | "cards";

export type FinancialNeed =
  | "goal_saving"
  | "surplus_management"
  | "basic_savings"
  | "student_banking"
  | "expense_financing"
  | "asset_financing"
  | "flexible_payments"
  | "wealth_growth"
  | "business_banking"
  | "financial_protection";

/** Behavioural / contextual signals the engine can detect. */
export type Signal =
  | "consistent_income"
  | "irregular_income"
  | "income_increase"
  | "salary_account"
  | "allowance_income"
  | "regular_surplus"
  | "low_surplus"
  | "stated_savings_goal"
  | "savings_in_everyday_account"
  | "has_dedicated_savings"
  | "repeated_saving_behaviour"
  | "planned_major_expense"
  | "planned_asset_purchase"
  | "student_activity"
  | "digital_first"
  | "high_card_spend"
  | "no_emergency_buffer"
  | "needs_immediate_liquidity"
  | "large_idle_balance";

export type CustomerSegment = "student" | "retail";

export type ExistingProductId =
  | "current_account"
  | "savings_account"
  | "debit_card"
  | "credit_card"
  | "save4me"
  | "aspire"
  | "eazysave"
  | "personal_loan"
  | "asset_finance";

export interface Transaction {
  /** Days before "today" in the demo. */
  daysAgo: number;
  description: string;
  amount: number;
  direction: "in" | "out";
  category: "salary" | "allowance" | "transfer" | "bills" | "airtime" | "food" | "transport" | "shopping" | "school" | "savings" | "rent" | "other";
}

/** Synthetic customer record (anonymised prototype data). */
export interface CustomerProfile {
  id: string;
  name: string;
  firstName: string;
  age: number;
  segment: CustomerSegment;
  occupation: string;
  city: string;
  persona: string;
  story: string;
  expectedOutcome: string;
  /** Last 6 months, oldest first (₦). */
  monthlyIncome: number[];
  /** Where income comes from. */
  incomeSource: "salary" | "allowance" | "mixed";
  /** Day of month the main credit usually lands. */
  incomeDay: number;
  /** Last 6 months, oldest first (₦). */
  monthlySpending: number[];
  /** Fixed recurring commitments per month (₦), included in spending. */
  recurringCommitments: number;
  averageBalance: number;
  /** Number of months in the last 6 with money deliberately set aside. */
  savingMonths: number;
  /** Share of outgoing payments made by card, POS, USSD or app (0–1). */
  digitalShare: number;
  cardSpendShare: number;
  /** School-related payments seen in account activity. */
  schoolPayments: boolean;
  existingProducts: ExistingProductId[];
  transactions: Transaction[];
  defaultGoal?: GoalDraft;
}

export interface GoalDraft {
  type: GoalType;
  label: string;
  amount: number;
  timelineMonths: number;
  saved?: number;
  expenseKind?: ExpenseKind;
}

export interface FinancialGoal extends GoalDraft {
  id: string;
  saved: number;
  createdAt: string;
}

/** A fact about a product with where it was published. */
export interface PublishedFact {
  text: string;
  source: string;
}

/**
 * Eligibility conditions the engine may check. Only conditions found in published
 * sources are listed; everything else is "subject to Zenith Bank's current requirements".
 */
export interface PublishedEligibility {
  minimum_age?: number;
  maximum_age?: number;
  /** Customer segments the product is published as being for. */
  segments?: CustomerSegment[];
  /** Product requires the customer's salary to be paid into a Zenith account. */
  salary_account_required?: boolean;
  source?: string;
}

/** MoneyMap's own prototype suitability guardrails (not Zenith eligibility). */
export interface SuitabilityRules {
  /** Principal-only monthly repayment must stay within this share of income. */
  max_principal_to_income?: number;
  /** Reported maximum balance — goals above it don't fit. */
  max_balance?: number;
}

export interface Product {
  product_id: string;
  name: string;
  category: ProductCategory;
  purpose: string;
  description: string;
  target_customer: CustomerSegment[];
  /** Publicly documented facts (with sources). */
  published: PublishedFact[];
  eligibility: PublishedEligibility;
  suitability: SuitabilityRules;
  financial_needs: FinancialNeed[];
  recommended_when: Signal[];
  not_recommended_when: Signal[];
  /** Existing holding that makes this product redundant. */
  equivalent_holding?: ExistingProductId;
  /** Customers can hold several (e.g. one SAVE4ME per goal). */
  multiple_allowed?: boolean;
  application_route: "digital" | "branch" | "relationship_manager";
  status: "active" | "inactive";
  version: number;
  updated_at: string;
}

export type FeedbackType = "useful" | "not_relevant" | "not_understood" | "not_wanted" | "remind_later";

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

export type RecommendationStatus = "recommended" | "explored" | "applied" | "dismissed" | "snoozed";

export type EligibilityStatus = "eligible" | "to_confirm" | "ineligible";

/** Stored recommendation (Phase 2 §14). */
export interface RecommendationRecord {
  id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  category: ProductCategory;
  need: FinancialNeed | null;
  match_score: number;
  reasons: string[];
  timing_reason: string;
  eligibility_status: EligibilityStatus;
  model_version: string;
  created_at: string;
  status: RecommendationStatus;
  feedback?: FeedbackType;
  feedback_at?: string;
  snoozed_until?: string;
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
