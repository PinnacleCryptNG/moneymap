// Mock REST client for the prototype. Each function mirrors an endpoint from spec §38.
// The prototype runs entirely in the browser on synthetic data; swapping these
// implementations for real `fetch` calls is the integration point for a backend.
import { runEngine, toApiResponse, type EngineInput, type EngineResult } from "../engine";
import type { Product } from "../types";

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
  "POST /api/v1/consent",
  "GET  /api/v1/customer/profile",
  "GET  /api/v1/customer/financial-context",
  "POST /api/v1/goals",
  "GET  /api/v1/goals",
  "POST /api/v1/recommendations",
  "GET  /api/v1/recommendations/:id",
  "GET  /api/v1/recommendations/:id/explanation",
  "POST /api/v1/recommendations/:id/feedback",
  "GET  /api/v1/products",
  "GET  /api/v1/products/:id",
  "POST /api/v1/products/:id/eligibility-check",
  "POST /api/v1/products/:id/apply",
  "GET  /api/v1/preferences",
  "PATCH /api/v1/preferences",
] as const;

/** POST /api/v1/recommendations */
export function postRecommendations(input: EngineInput, opts: { simulateError?: boolean } = {}): Promise<EngineResult> {
  return delay(() => runEngine(input), opts.simulateError);
}

/** POST /api/v1/products/:id/eligibility-check */
export function postEligibilityCheck(input: EngineInput, productId: string) {
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
