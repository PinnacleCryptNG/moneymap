// Notifications: delivering MoneyMap's messages through Zenith's channels (app push, in-app inbox).
// MoneyMap decides *whether* to message; the bank's messaging platform owns delivery and channel rules.
import type { AppNotification } from "../../src/types";
import { newHealth, request, trackFail, trackOk, type AdapterHealth, type HttpOptions } from "./http";

export interface NotificationAdapter {
  name: "notifications";
  health: AdapterHealth;
  /** Returns the channel's reference for the delivered message. */
  deliver(n: AppNotification): Promise<{ reference: string; channel: string }>;
}

export function notificationAdapter(http: HttpOptions | null): NotificationAdapter {
  const health = newHealth(http ? "http" : "demo", http?.baseUrl);
  return {
    name: "notifications",
    health,
    async deliver(n) {
      if (!http) {
        trackOk(health);
        // Demo: the MoneyMap inbox in the app is the only channel.
        return { reference: `INAPP-${n.id}`, channel: "in_app" };
      }
      try {
        const r = await request<{ reference: string; channel?: string }>(
          http,
          "POST",
          "messages",
          {
            customer_id: n.customer_id,
            title: n.title,
            body: n.body,
            deep_link: "moneymap://recommendation",
            category: "product_suggestion",
          },
          // The same message is never delivered twice, even if MoneyMap retries.
          { "idempotency-key": n.id },
        );
        trackOk(health);
        return { reference: r.reference, channel: r.channel ?? "push" };
      } catch (e) {
        trackFail(health, e);
        throw e;
      }
    },
  };
}
