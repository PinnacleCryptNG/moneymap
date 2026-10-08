// Event triggers: when money lands, MoneyMap takes a fresh look — and usually stays quiet.
// Pure functions shared by the server and the browser-only demo.
import type { AppNotification, CustomerProfile, Permissions, RawTransaction, RecommendationRecord, Trigger } from "../types";
import { formatNaira } from "../utils/format";
import type { EngineResult } from ".";
import { categorise, describe } from "./ledger";

/** At most one message per customer in this many days. */
export const NOTIFY_WINDOW_DAYS = 7;
/** A one-off credit at least this share of usual monthly income counts as a windfall. */
export const WINDFALL_SHARE = 0.5;

const DAY = 86_400_000;
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

/** Is this new statement line worth a fresh look? Only money coming in triggers one for now. */
export function detectTrigger(tx: RawTransaction, profile: CustomerProfile): Trigger | null {
  if (tx.direction !== "credit") return null;
  const category = categorise(tx);
  const description = describe(tx);
  if (category === "salary" || category === "allowance") return { type: "income_received", amount: tx.amount, description };
  const usual = mean(profile.monthlyIncome);
  if (usual > 0 && tx.amount >= WINDFALL_SHARE * usual) return { type: "windfall", amount: tx.amount, description };
  return null;
}

/** Why this moment matters, in the customer's terms. Used as the timing reason for savings products. */
export function triggerTimingReason(t: Trigger): string {
  return t.type === "income_received"
    ? `Your ${t.description.toLowerCase().startsWith("allowance") ? "allowance" : "salary"} of ${formatNaira(t.amount)} has just arrived. Setting money aside now, before the month's spending starts, makes it easier to keep.`
    : `${formatNaira(t.amount)} has just arrived on top of your usual income. Giving it somewhere to go now stops it slipping into everyday spending.`;
}

export type TriggerDecision =
  | { outcome: "notified"; kind: AppNotification["kind"]; title: string; body: string; reason: string }
  | { outcome: "held_back"; reason: string };

/**
 * Decide whether a trigger deserves a message. The engine has already run with the trigger;
 * this adds the messaging rules on top: consent, a real match, and at most one message a week.
 */
export function decideOnTrigger(args: {
  trigger: Trigger;
  permissions: Permissions;
  result: EngineResult;
  history: RecommendationRecord[];
  notifications: AppNotification[];
  now: Date;
}): TriggerDecision {
  const { trigger, permissions, result, history, notifications, now } = args;
  if (!permissions.income_patterns)
    return { outcome: "held_back", reason: "You haven't shared income patterns, so MoneyMap doesn't act on money coming in." };
  if (result.status !== "recommended" || !result.top)
    return { outcome: "held_back", reason: result.message || "Nothing would meaningfully help right now." };
  const recent = notifications.find((n) => now.getTime() - new Date(n.created_at).getTime() < NOTIFY_WINDOW_DAYS * DAY);
  if (recent)
    return { outcome: "held_back", reason: `MoneyMap already sent you a message in the last ${NOTIFY_WINDOW_DAYS} days, and sends at most one a week.` };

  const p = result.top.product;
  const open = history.find((h) => h.product_id === p.product_id && !h.feedback && h.status !== "applied");
  const moment = trigger.type === "income_received" ? "Your money has just landed" : "Money just arrived";
  return open
    ? {
        outcome: "notified",
        kind: "reminder",
        title: `${moment} — a good moment for ${p.name}`,
        body: `${triggerTimingReason(trigger)} ${p.name} is still waiting for you whenever you're ready.`,
        reason: `Reminder about ${p.name}, which is still open (match ${result.top.score}).`,
      }
    : {
        outcome: "notified",
        kind: "new_recommendation",
        title: `${moment} — ${p.name} could help`,
        body: `${triggerTimingReason(trigger)} See why we think ${p.name} fits, or tell us it doesn't.`,
        reason: `New recommendation: ${p.name} (match ${result.top.score}).`,
      };
}

/** Demo only: the statement line a core-banking feed would send for "salary lands" or "a bonus arrives". */
export function simulatedCredit(type: "income" | "windfall", profile: CustomerProfile, date: string, id: string): RawTransaction {
  const employer = (profile.derivation?.income?.employer ?? "EMPLOYER").toUpperCase();
  const month = new Date(`${date}T00:00:00Z`).toLocaleString("en-GB", { month: "short", timeZone: "UTC" }).toUpperCase();
  const year = date.slice(0, 4);
  const usual = mean(profile.monthlyIncome);
  const round = (x: number, to: number) => Math.max(to, Math.round(x / to) * to);
  if (type === "income") {
    const main = profile.derivation?.income?.sources[0]?.monthlyAverage ?? usual;
    return profile.incomeSource === "allowance"
      ? { id, date, narration: `NIP TRF FROM FAMILY/${month} ALLOWANCE`, amount: round(main, 1000), direction: "credit", channel: "transfer" }
      : { id, date, narration: `NIP/${employer}/SALARY ${month} ${year}`, amount: round(main, 5000), direction: "credit", channel: "transfer" };
  }
  return { id, date, narration: `NIP/${employer}/PERFORMANCE BONUS ${year}`, amount: round(usual * 2, 50000), direction: "credit", channel: "transfer" };
}
