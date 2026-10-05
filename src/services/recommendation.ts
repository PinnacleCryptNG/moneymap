import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../app/providers/store";
import { runEngine, type EngineInput, type EngineResult } from "../engine";
import type { RecommendationRecord } from "../types";
import { postRecommendations } from "./api";

export function useEngineInput(requestedMore = false): EngineInput {
  const { state, customer, activeGoal } = useStore();
  return useMemo(
    () => ({
      customer,
      permissions: state.permissions,
      goal: activeGoal,
      preferences: state.preferences,
      products: state.products,
      history: state.recommendations,
      requestedMore,
    }),
    [customer, state.permissions, activeGoal, state.preferences, state.products, state.recommendations, requestedMore],
  );
}

/** Synchronous engine evaluation (for summaries such as the dashboard and map). */
export function useEngineResult(requestedMore = false): EngineResult {
  const input = useEngineInput(requestedMore);
  return useMemo(() => runEngine(input), [input]);
}

/** The live recommendation for this customer, matching the decision engine's latest output. */
export function findActiveRecord(records: RecommendationRecord[], productId: string | undefined) {
  if (!productId) return undefined;
  return records.find((r) => r.productId === productId && !r.feedback);
}

/**
 * Requests a recommendation through the (mock) API, with loading and error states,
 * and records an exposure the first time a product is shown.
 */
export function useRecommendation(requestedMore = false) {
  const { state, dispatch } = useStore();
  const input = useEngineInput(requestedMore);
  const [result, setResult] = useState<EngineResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const recordsRef = useRef(state.recommendations);
  recordsRef.current = state.recommendations;

  // Re-evaluate only when inputs other than history change, so feedback doesn't trigger a loading flash.
  const key = JSON.stringify([
    input.customer.id,
    input.permissions,
    input.goal,
    input.preferences,
    input.products.map((p) => [p.product_id, p.version]),
    requestedMore,
    attempt,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    postRecommendations({ ...input, history: recordsRef.current }, { simulateError: state.simulateError })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        if (r.top && !findActiveRecord(recordsRef.current, r.top.product.product_id)) {
          dispatch({
            type: "record_recommendation",
            record: {
              productId: r.top.product.product_id,
              productName: r.top.product.name,
              category: r.top.product.category,
              score: r.top.score,
            },
          });
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const retry = useCallback(() => setAttempt((a) => a + 1), []);
  const record = findActiveRecord(state.recommendations, result?.top?.product.product_id) ??
    state.recommendations.find((r) => r.productId === result?.top?.product.product_id);

  return { result, error, loading, retry, record };
}
