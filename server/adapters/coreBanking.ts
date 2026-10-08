// Core banking: the customer's statement. MoneyMap keeps a consented working copy in its own store and
// refreshes it from the bank; if the bank can't be reached, it keeps deciding on the last good copy.
import type { RawTransaction } from "../../src/types";
import { newHealth, request, trackFail, trackOk, type AdapterHealth, type HttpOptions } from "./http";

export interface CoreBankingAdapter {
  name: "core_banking";
  health: AdapterHealth;
  /**
   * Fetch the statement lines from `fromDate` (YYYY-MM-DD) onwards.
   * Returns null when MoneyMap's stored copy is the source (demo mode).
   */
  statement(customerId: string, fromDate: string): Promise<RawTransaction[] | null>;
}

const CHANNELS = new Set(["transfer", "pos", "web", "bill_payment", "atm", "standing_order"]);

/** Reject anything that doesn't match the contract instead of feeding it to the engine. */
export function validLine(t: unknown): t is RawTransaction {
  const x = t as Record<string, unknown>;
  return (
    !!x &&
    typeof x.id === "string" && x.id.length > 0 && x.id.length <= 64 &&
    typeof x.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(x.date) &&
    typeof x.narration === "string" && x.narration.length <= 140 &&
    Number.isInteger(x.amount) && (x.amount as number) > 0 &&
    (x.direction === "credit" || x.direction === "debit") &&
    typeof x.channel === "string" && CHANNELS.has(x.channel)
  );
}

export function coreBankingAdapter(http: HttpOptions | null): CoreBankingAdapter {
  const health = newHealth(http ? "http" : "demo", http?.baseUrl);
  return {
    name: "core_banking",
    health,
    async statement(customerId, fromDate) {
      if (!http) {
        trackOk(health);
        return null;
      }
      try {
        const r = await request<{ transactions: unknown[] }>(http, "GET", `customers/${encodeURIComponent(customerId)}/transactions?from=${fromDate}`);
        const lines = (r.transactions ?? []).filter(validLine);
        trackOk(health);
        return lines;
      } catch (e) {
        trackFail(health, e);
        throw e;
      }
    },
  };
}
