import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../app/providers/store";
import { runEngine, toRecord, type EngineInput, type EngineResult } from "../engine";
import type { Product, RecommendationRecord } from "../types";
import { postRecommendations } from "./api";

/** The server sends products as short references; put the catalogue's full details back. */
export function withCatalogue(r: EngineResult, products: Product[]): EngineResult {
  const full = (e: EngineResult["ranked"][number]) => ({ ...e, product: products.find((p) => p.product_id === e.product.product_id) ?? e.product });
  const ranked = r.ranked.map(full);
  return { ...r, ranked, top: r.top ? (ranked.find((e) => e.product.product_id === r.top!.product.product_id) ?? null) : null };
}
import { API_MODE, http } from "./http";

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
      selfReport: state.selfReport,
    }),
    [customer, state.permissions, activeGoal, state.preferences, state.products, state.recommendations, requestedMore, state.selfReport],
  );
}

/**
 * The engine's view of this customer (dashboard, map, products, Why).
 * Local mode: computed in the browser. API mode: fetched from GET /customer/moneymap — the server is
 * the authority; the identical local engine only fills the first frame until the server answers.
 */
export function useEngineResult(requestedMore = false): EngineResult {
  const input = useEngineInput(requestedMore);
  const local = useMemo(() => runEngine(input), [input]);
  const server = useServerPreview(requestedMore, input);
  return server ?? local;
}

function useServerPreview(requestedMore: boolean, input: EngineInput): EngineResult | null {
  const { synced, dispatch } = useStore();
  const [result, setResult] = useState<EngineResult | null>(null);
  const key = JSON.stringify([
    input.customer.id,
    input.permissions,
    input.goal,
    input.preferences,
    input.products.map((p) => [p.product_id, p.status, p.version]),
    input.history.map((h) => [h.id, h.status, h.feedback]),
    requestedMore,
    input.selfReport?.updatedAt,
  ]);
  useEffect(() => {
    if (!API_MODE || !http.hasSession()) return;
    let cancelled = false;
    synced()
      .then(() => http.preview(requestedMore))
      .then((r) => !cancelled && setResult(withCatalogue(r, input.products)))
      .catch((e: Error) => !cancelled && dispatch({ type: "sync_error", message: `Couldn't load your MoneyMap from the server: ${e.message}` }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return result;
}

/** The live recommendation for this customer, matching the decision engine's latest output. */
export function findActiveRecord(records: RecommendationRecord[], productId: string | undefined) {
  if (!productId) return undefined;
  return records.find((r) => r.product_id === productId && !r.feedback);
}

/**
 * Requests a recommendation through the (mock) API, with loading and error states,
 * and records an exposure the first time a product is shown.
 */
export function useRecommendation(requestedMore = false) {
  const { state, dispatch, customer, synced } = useStore();
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
    input.selfReport?.updatedAt,
    attempt,
  ]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const request = API_MODE
      ? // The server runs the engine on consent-filtered data and stores the recommendation.
        // Wait for queued writes (e.g. feedback just given) so the server decides on current data.
        (state.simulateError ? Promise.reject(new Error("Connection interrupted")) : synced().then(() => http.recommend(requestedMore))).then(async (res) => {
          dispatch({ type: "hydrate", snapshot: await http.snapshot() });
          return withCatalogue(res.engine, input.products);
        })
      : postRecommendations({ ...input, history: recordsRef.current }, { simulateError: state.simulateError }).then((r) => {
          const record = toRecord(r, customer.id);
          if (record && !findActiveRecord(recordsRef.current, record.product_id)) {
            dispatch({ type: "record_recommendation", record });
          }
          return r;
        });
    request
      .then((r) => {
        if (!cancelled) setResult(r);
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
    state.recommendations.find((r) => r.product_id === result?.top?.product.product_id);

  return { result, error, loading, retry, record };
}
