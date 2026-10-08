import type { Product } from "../types";

/**
 * DEMONSTRATION CATALOGUE — Zenith Bank products (Phase 2 §10).
 *
 * Rules:
 * - Only facts found in public sources appear under `published`, each with its source.
 *   Most sources are press or comparison sites, not Zenith's own pages, so every fact
 *   must be confirmed against Zenith's approved product information before a pilot.
 * - No interest rates, fees, limits, approval guarantees or processing times are invented.
 *   Anything not published is shown as "Subject to Zenith Bank's current requirements".
 * - `suitability` holds MoneyMap's own prototype guardrails. They are not Zenith eligibility.
 */
const T = "2026-10-08T09:00:00.000Z";

export const SUBJECT_TO_ZENITH = "Terms and eligibility are subject to Zenith Bank's current requirements.";

export const SOURCES = {
  save4me: "https://nairametrics.com/?p=183571",
  aspire: "https://nairacompare.ng/savings/personal-savings-account/zenith-aspire-account",
  aspireLaunch: "https://businessday.ng/banking/article/zenith-bank-game-changer-in-innovative-retail-banking/",
  eazysave: "https://nairacompare.ng/savings/personal-savings-account/zenith-eazysave-classic-account",
  personalLoan: "https://nairacompare.ng/blog/loans/how-to-get-a-loan-from-zenith-bank",
} as const;

export const SEED_PRODUCTS: Product[] = [
  {
    product_id: "ZEN_SAVE4ME",
    name: "SAVE4ME",
    category: "savings",
    purpose: "Target savings for a specific goal",
    description:
      "A target savings account for putting money aside towards something specific — an asset, rent, a wedding — kept apart from your everyday spending. You can run separate SAVE4ME accounts for different goals.",
    target_customer: ["retail", "student"],
    published: [
      { text: "Target savings account for predetermined purposes such as asset acquisition or marriage.", source: SOURCES.save4me },
      { text: "Customers can operate multiple SAVE4ME accounts for different goals at the same time.", source: SOURCES.save4me },
      { text: "Offers a higher interest rate than a regular savings account (rate not published here — confirm with Zenith).", source: SOURCES.save4me },
    ],
    eligibility: {},
    suitability: {},
    financial_needs: ["goal_saving", "surplus_management"],
    recommended_when: [
      "stated_savings_goal",
      "regular_surplus",
      "consistent_income",
      "savings_in_everyday_account",
      "repeated_saving_behaviour",
    ],
    not_recommended_when: ["needs_immediate_liquidity"],
    equivalent_holding: "save4me",
    multiple_allowed: true,
    application_route: "digital",
    status: "active",
    version: 1,
    updated_at: T,
  },
  {
    product_id: "ZEN_ASPIRE",
    name: "Aspire",
    category: "accounts",
    purpose: "Banking built for students",
    description:
      "Zenith's account for students — card-first, cashless banking across ATM, POS, web and mobile, with merchant discounts. (The team brief lists Aspire / Aspire Lite; only Aspire is documented in the sources found.)",
    target_customer: ["student"],
    published: [
      { text: "Designed for students who want flexibility, convenience, benefits and rewards.", source: SOURCES.aspireLaunch },
      { text: "Zero account opening balance.", source: SOURCES.aspire },
      { text: "Choice of card design; cashless banking via ATM, POS, web and mobile; Z-Mart merchant discounts.", source: SOURCES.aspire },
      { text: "Reported requirements include BVN, school ID / admission letter or NIN, and parent or guardian details for applicants aged 16–25.", source: SOURCES.aspire },
    ],
    eligibility: { segments: ["student"], minimum_age: 16, maximum_age: 25, source: SOURCES.aspire },
    suitability: {},
    financial_needs: ["student_banking"],
    recommended_when: ["student_activity", "allowance_income", "digital_first"],
    not_recommended_when: [],
    equivalent_holding: "aspire",
    application_route: "digital",
    status: "active",
    version: 1,
    updated_at: T,
  },
  {
    product_id: "ZEN_EAZYSAVE",
    name: "EazySave",
    category: "savings",
    purpose: "Simple savings with minimal documentation",
    description:
      "An entry-level savings account built for financial inclusion — for people starting to save who may have minimal forms of identification. Classic and Premium versions exist with reported deposit and balance caps.",
    target_customer: ["retail", "student"],
    published: [
      { text: "Designed to facilitate financial inclusion for individuals with minimal forms of identification.", source: SOURCES.eazysave },
      { text: "Zero account opening balance.", source: SOURCES.eazysave },
      { text: "Reported caps — Classic: ₦200,000 maximum balance; Premium: ₦400,000 maximum balance.", source: SOURCES.eazysave },
    ],
    eligibility: {},
    suitability: { max_balance: 400000 },
    financial_needs: ["basic_savings"],
    recommended_when: ["no_emergency_buffer", "low_surplus", "irregular_income"],
    not_recommended_when: ["has_dedicated_savings"],
    equivalent_holding: "eazysave",
    application_route: "digital",
    status: "active",
    version: 1,
    updated_at: T,
  },
  {
    product_id: "ZEN_PERSONAL_LOAN",
    name: "Personal Loan",
    category: "financing",
    purpose: "Finance a planned personal expense",
    description:
      "A loan for a planned personal need such as school fees, rent or a wedding, repaid from salary. Approval, amount and rate are decided by Zenith's credit assessment — MoneyMap does not approve credit.",
    target_customer: ["retail"],
    published: [
      { text: "Reported requirement: a Zenith account into which salary and allowances are paid.", source: SOURCES.personalLoan },
      { text: "Reported age range: 18 to 60.", source: SOURCES.personalLoan },
      { text: "Reported documents: BVN, valid ID, recent utility bill and 3 months' statement, among others.", source: SOURCES.personalLoan },
    ],
    eligibility: { minimum_age: 18, maximum_age: 60, salary_account_required: true, source: SOURCES.personalLoan },
    suitability: { max_principal_to_income: 0.33 },
    financial_needs: ["expense_financing"],
    recommended_when: ["planned_major_expense", "consistent_income", "salary_account"],
    not_recommended_when: ["irregular_income"],
    equivalent_holding: "personal_loan",
    application_route: "digital",
    status: "active",
    version: 1,
    updated_at: T,
  },
  {
    product_id: "ZEN_ASSET_FINANCE",
    name: "Asset Finance",
    category: "financing",
    purpose: "Finance the purchase of an asset such as a car",
    description:
      "Financing to acquire an asset — typically a vehicle or equipment — paid back over time. Product details were not found in public sources during the build and must come from Zenith's approved catalogue.",
    target_customer: ["retail"],
    published: [],
    eligibility: {},
    suitability: { max_principal_to_income: 0.33 },
    financial_needs: ["asset_financing"],
    recommended_when: ["planned_asset_purchase", "consistent_income", "salary_account"],
    not_recommended_when: ["irregular_income"],
    equivalent_holding: "asset_finance",
    application_route: "branch",
    status: "active",
    version: 1,
    updated_at: T,
  },
  {
    product_id: "ZEN_CREDIT_CARD",
    name: "Credit Card",
    category: "cards",
    purpose: "Flexible card payments with a credit line",
    description:
      "A credit card for customers with steady income who already pay mostly by card. Card variants, limits and charges were not found in public sources during the build and must come from Zenith's approved catalogue.",
    target_customer: ["retail"],
    published: [],
    eligibility: {},
    suitability: {},
    financial_needs: ["flexible_payments"],
    recommended_when: ["high_card_spend", "consistent_income", "salary_account"],
    not_recommended_when: ["low_surplus", "irregular_income"],
    equivalent_holding: "credit_card",
    application_route: "digital",
    status: "active",
    version: 1,
    updated_at: T,
  },
];
