import { deriveProfile } from "../engine/ledger";
import type { CustomerProfile, PersonaBase } from "../types";
import { buildLedger, DEMO_TODAY, openingBalance } from "./ledgers";

/**
 * Synthetic, anonymised demo customers (Phase 2 §9). No real customer data is used.
 * Names, employers and counterparties are fictional.
 */
const PERSONAS: Omit<PersonaBase, "openingBalance">[] = [
  {
    id: "CUST_SARAH",
    name: "Sarah Okafor",
    firstName: "Sarah",
    age: 24,
    segment: "retail",
    occupation: "Customer experience officer",
    city: "Lekki, Lagos",
    persona: "The Saver",
    story: "Steady salary and a monthly surplus — but what she saves stays in the same account she spends from.",
    expectedOutcome: "Goal-based savings → SAVE4ME",
    existingProducts: ["current_account", "debit_card"],
    defaultGoal: {
      type: "save_more",
      label: "Save ₦1,000,000",
      amount: 1000000,
      timelineMonths: 12,
      saved: 0,
    },
  },
  {
    id: "CUST_TOLU",
    name: "Tolu Adebayo",
    firstName: "Tolu",
    age: 35,
    segment: "retail",
    occupation: "Senior accountant",
    city: "Ikeja, Lagos",
    persona: "The No-Match Customer",
    story: "Already saving through SAVE4ME, already has a credit card he pays off in full, and has no new goal. Nothing in the catalogue would meaningfully improve his situation.",
    expectedOutcome: "No recommendation",
    existingProducts: ["current_account", "debit_card", "save4me", "credit_card"],
    defaultGoal: {
      type: "not_sure",
      label: "Not sure yet",
      amount: 0,
      timelineMonths: 12,
      saved: 0,
    },
  },
];

/** Read a persona's account: every financial figure is derived from their six-month statement. */
export function profileFromLedger(base: PersonaBase, ledger = buildLedger(base.id)): CustomerProfile {
  return deriveProfile(base, ledger, { today: DEMO_TODAY, openingBalance: base.openingBalance });
}

/**
 * Not a demo account: a student profile used only to seed the bank view's synthetic cohort,
 * so the bank-wide metrics include students alongside the two demo customers.
 */
const STUDENT_ARCHETYPE: Omit<PersonaBase, "openingBalance"> =
  {
    id: "ARCH_STUDENT",
    name: "Daniel Eze",
    firstName: "Daniel",
    age: 21,
    segment: "student",
    occupation: "300-level Computer Science student",
    city: "Akoka, Lagos",
    persona: "The Young Customer",
    story: "Lives on a monthly allowance plus small design gigs, pays for almost everything by card and app — still on a basic savings account his parents opened.",
    expectedOutcome: "Student banking → Aspire",
    existingProducts: ["savings_account", "debit_card"],
    defaultGoal: {
      type: "everyday",
      label: "Manage my everyday money",
      amount: 0,
      timelineMonths: 12,
      saved: 0,
    },
  };

const withBalance = (p: Omit<PersonaBase, "openingBalance">): PersonaBase => ({ ...p, openingBalance: openingBalance(p.id) });

/** The demo customers: Sarah (gets SAVE4ME) and Tolu (gets nothing). */
export const PERSONA_BASES: PersonaBase[] = PERSONAS.map(withBalance);
export const CUSTOMERS: CustomerProfile[] = PERSONA_BASES.map((b) => profileFromLedger(b));
/** Profiles the bank view's synthetic cohort is generated from. */
export const COHORT_ARCHETYPES: CustomerProfile[] = [...CUSTOMERS, profileFromLedger(withBalance(STUDENT_ARCHETYPE))];

export function getCustomer(id: string): CustomerProfile {
  return CUSTOMERS.find((c) => c.id === id) ?? CUSTOMERS[0];
}
