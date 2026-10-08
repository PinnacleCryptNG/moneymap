// Applications: handing a customer's "I'd like this" to Zenith's existing onboarding / credit process.
// MoneyMap records intent only. It never opens accounts, approves credit or moves money.
import type { Product } from "../../src/types";
import { newHealth, request, trackFail, trackOk, type AdapterHealth, type HttpOptions } from "./http";

export interface ApplicationAdapter {
  name: "applications";
  health: AdapterHealth;
  /** Returns the bank's reference for the hand-off. */
  submit(args: { applicationId: string; customerId: string; product: Product; recommendationId: string | null }): Promise<{ reference: string }>;
}

export function applicationAdapter(http: HttpOptions | null): ApplicationAdapter {
  const health = newHealth(http ? "http" : "demo", http?.baseUrl);
  return {
    name: "applications",
    health,
    async submit({ applicationId, customerId, product, recommendationId }) {
      if (!http) {
        trackOk(health);
        return { reference: `DEMO-${applicationId.slice(-8)}` };
      }
      try {
        const r = await request<{ reference: string }>(
          http,
          "POST",
          "product-requests",
          {
            customer_id: customerId,
            product_id: product.product_id,
            product_name: product.name,
            source: "moneymap",
            recommendation_id: recommendationId,
          },
          { "idempotency-key": applicationId },
        );
        trackOk(health);
        return { reference: r.reference };
      } catch (e) {
        trackFail(health, e);
        throw e;
      }
    },
  };
}
