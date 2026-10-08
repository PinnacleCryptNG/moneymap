// Recommendation API seam. In local mode (the hosted single-page demo) these run the engine in the
// browser; in API mode (VITE_API_MODE=http) they call the MoneyMap server — see services/http.ts.
import { runEngine, toApiResponse, type EngineInput, type EngineResult, type Evaluation } from "../engine";
import type { Product } from "../types";
import { API_MODE, http } from "./http";

export class ApiError extends Error {}

const LATENCY_MS = 450;

function delay<T>(value: () => T, fail = false): Promise<T> {
  return new Promise((resolve, reject) =>
    setTimeout(() => {
      if (fail) reject(new ApiError("Connection interrupted"));
      else {
        try {
          resolve(value());
        } catch (e) {
          reject(e);
        }
      }
    }, LATENCY_MS),
  );
}

export const ENDPOINTS = [
  "POST  /api/v1/demo/session",
  "GET   /api/v1/customer/profile",
  "GET   /api/v1/customer/financial-context",
  "GET   /api/v1/consent",
  "POST  /api/v1/consent",
  "GET   /api/v1/goals",
  "POST  /api/v1/goals",
  "PATCH /api/v1/goals/:id",
  "DELETE /api/v1/goals/:id",
  "POST  /api/v1/recommendations",
  "GET   /api/v1/recommendations",
  "GET   /api/v1/recommendations/:id",
  "GET   /api/v1/recommendations/:id/explanation",
  "POST  /api/v1/recommendations/:id/feedback",
  "GET   /api/v1/products",
  "GET   /api/v1/products/:id",
  "POST  /api/v1/products/:id/eligibility-check",
  "POST  /api/v1/products/:id/apply",
  "GET   /api/v1/preferences",
  "PATCH /api/v1/preferences",
  "GET   /api/v1/admin/metrics",
  "GET   /api/v1/admin/audit",
  "PATCH /api/v1/admin/products/:id",
] as const;

/** POST /api/v1/recommendations */
export function postRecommendations(input: EngineInput, opts: { simulateError?: boolean } = {}): Promise<EngineResult> {
  return delay(() => runEngine(input), opts.simulateError);
}

/** POST /api/v1/products/:id/eligibility-check */
export function postEligibilityCheck(input: EngineInput, productId: string): Promise<Pick<Evaluation, "eligibility">> {
  if (API_MODE) return http.eligibility(productId);
  return delay(() => {
    const result = runEngine({ ...input, requestedMore: true });
    const evaluation = result.ranked.find((e) => e.product.product_id === productId);
    if (!evaluation) throw new ApiError("Product not found");
    return evaluation;
  });
}

/** POST /api/v1/products/:id/apply — prototype only: records intent, no real account opening or credit approval. */
export function postApply(product: Product) {
  return delay(() => ({ status: "submitted" as const, product_id: product.product_id }));
}

export { toApiResponse };
