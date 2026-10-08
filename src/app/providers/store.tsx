import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from "react";
import { getCustomer, PERSONA_BASES, profileFromLedger } from "../../data/customers";
import { buildLedger, DEMO_TODAY } from "../../data/ledgers";
import { DEFAULT_PREFERENCES } from "../../data/defaults";
import { SEED_PRODUCTS } from "../../data/products";
import type {
  AppNotification,
  Application,
  AuditEntry,
  ConsentRecord,
  FeedbackType,
  FinancialGoal,
  GoalDraft,
  PermissionKey,
  Permissions,
  Preferences,
  Product,
  RecommendationRecord,
  RawTransaction,
  RecommendationStatus,
  TriggerEvent,
  CustomerProfile,
} from "../../types";
import { REMIND_LATER_DAYS, runEngine, toRecord } from "../../engine";
import { decideOnTrigger, detectTrigger, simulatedCredit } from "../../engine/triggers";
import { API_MODE, http, HttpError, type ServerSnapshot } from "../../services/http";
import { syncAction } from "../../services/sync";
import { uid } from "../../utils/format";

export interface AppState {
  schema: 5;
  customerId: string;
  onboarded: boolean;
  permissions: Permissions;
  consentLog: ConsentRecord[];
  goals: FinancialGoal[];
  activeGoalId: string | null;
  preferences: Preferences;
  recommendations: RecommendationRecord[];
  applications: Application[];
  /** Statement lines that arrived after the six-month history (step 3). */
  liveTransactions: RawTransaction[];
  /** Messages MoneyMap sent, and every trigger it noticed with what it decided. */
  notifications: AppNotification[];
  triggerEvents: TriggerEvent[];
  products: Product[];
  productVersions: Product[];
  audit: AuditEntry[];
  simulateError: boolean;
  /** API mode: last error talking to the server, shown as a banner. */
  syncError: string | null;
}

const NO_PERMISSIONS: Permissions = {
  account_activity: false,
  income_patterns: false,
  spending_patterns: false,
  existing_products: false,
  financial_goals: false,
};


function customerState(customerId: string): Pick<
  AppState,
  | "customerId" | "onboarded" | "permissions" | "consentLog" | "goals" | "activeGoalId" | "preferences" | "recommendations" | "applications"
  | "liveTransactions" | "notifications" | "triggerEvents"
> {
  return {
    customerId,
    onboarded: false,
    permissions: NO_PERMISSIONS,
    consentLog: [],
    goals: [],
    activeGoalId: null,
    preferences: DEFAULT_PREFERENCES,
    recommendations: [],
    applications: [],
    liveTransactions: [],
    notifications: [],
    triggerEvents: [],
  };
}

/** The customer as MoneyMap reads them: the six-month statement plus anything that has arrived since. */
function profileFor(customerId: string, live: RawTransaction[]): CustomerProfile {
  const base = PERSONA_BASES.find((b) => b.id === customerId);
  return base && live.length ? profileFromLedger(base, [...buildLedger(base.id), ...live]) : getCustomer(customerId);
}

function initialState(): AppState {
  return {
    schema: 5,
    ...customerState("CUST_SARAH"),
    products: SEED_PRODUCTS,
    productVersions: [],
    audit: [],
    simulateError: false,
    syncError: null,
  };
}

export const STORAGE_KEY = "moneymap:v5";

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.schema === 5) return { ...parsed, syncError: null };
    }
  } catch {
    /* storage unavailable — fall back to defaults */
  }
  return initialState();
}

export type Action =
  | { type: "select_customer"; customerId: string }
  | { type: "demo_load"; customerId: string }
  | { type: "complete_onboarding"; permissions: Permissions; goal: GoalDraft | null }
  | { type: "set_permission"; key: PermissionKey; granted: boolean }
  | { type: "withdraw_all" }
  | { type: "upsert_goal"; goal: GoalDraft & { id?: string } }
  | { type: "delete_goal"; id: string }
  | { type: "set_active_goal"; id: string }
  | { type: "contribute"; id: string; amount: number }
  | { type: "set_preferences"; preferences: Preferences }
  | { type: "record_recommendation"; record: Omit<RecommendationRecord, "id" | "created_at" | "status"> }
  | { type: "set_recommendation_status"; id: string; status: RecommendationStatus }
  | { type: "feedback"; id: string; feedback: FeedbackType }
  | { type: "apply"; productId: string; productName: string }
  | { type: "set_product_status"; productId: string; status: Product["status"] }
  | { type: "simulate_event"; event: "income" | "windfall" }
  | { type: "read_notification"; id: string }
  | { type: "set_simulate_error"; value: boolean }
  | { type: "reset" }
  | { type: "hydrate"; snapshot: ServerSnapshot }
  | { type: "sync_error"; message: string | null };

function audit(state: AppState, actor: AuditEntry["actor"], action: string, detail: string): AuditEntry[] {
  return [{ id: uid("AUD"), at: new Date().toISOString(), actor, action, detail }, ...state.audit].slice(0, 300);
}


function reducer(state: AppState, action: Action): AppState {
  const now = new Date().toISOString();
  switch (action.type) {
    case "select_customer": {
      const c = getCustomer(action.customerId);
      return {
        ...state,
        ...customerState(c.id),
        audit: audit(state, "system", "demo.customer_selected", `Switched demo customer to ${c.name} (${c.persona}).`),
      };
    }
    case "demo_load": {
      // Demo Mode: load a persona's full context instantly (team-only presentation tool).
      const c = getCustomer(action.customerId);
      const all: Permissions = {
        account_activity: true,
        income_patterns: true,
        spending_patterns: true,
        existing_products: true,
        financial_goals: true,
      };
      const goals: FinancialGoal[] = c.defaultGoal
        ? [{ ...c.defaultGoal, id: uid("GOAL"), saved: c.defaultGoal.saved ?? 0, createdAt: now }]
        : [];
      return {
        ...state,
        ...customerState(c.id),
        onboarded: true,
        permissions: all,
        consentLog: [{ id: uid("CON"), permission: "all", granted: true, at: now }],
        goals,
        activeGoalId: goals[0]?.id ?? null,
        audit: audit(state, "system", "demo.persona_loaded", `Demo Mode loaded ${c.name} (${c.persona}).`),
      };
    }
    case "complete_onboarding": {
      const consentLog: ConsentRecord[] = (Object.keys(action.permissions) as PermissionKey[]).map((p) => ({
        id: uid("CON"),
        permission: p,
        granted: action.permissions[p],
        at: now,
      }));
      let goals = state.goals;
      let activeGoalId = state.activeGoalId;
      if (action.goal) {
        const goal: FinancialGoal = { ...action.goal, id: uid("GOAL"), saved: action.goal.saved ?? 0, createdAt: now };
        goals = [goal, ...goals.filter((g) => g.type !== goal.type)];
        activeGoalId = goal.id;
      }
      return {
        ...state,
        onboarded: true,
        permissions: action.permissions,
        consentLog: [...consentLog, ...state.consentLog],
        goals,
        activeGoalId,
        audit: audit(
          state,
          "customer",
          "consent.recorded",
          `Granted: ${(Object.keys(action.permissions) as PermissionKey[]).filter((k) => action.permissions[k]).join(", ") || "none"}.`,
        ),
      };
    }
    case "set_permission":
      return {
        ...state,
        permissions: { ...state.permissions, [action.key]: action.granted },
        consentLog: [{ id: uid("CON"), permission: action.key, granted: action.granted, at: now }, ...state.consentLog],
        audit: audit(state, "customer", action.granted ? "consent.granted" : "consent.withdrawn", action.key),
      };
    case "withdraw_all":
      return {
        ...state,
        permissions: NO_PERMISSIONS,
        consentLog: [{ id: uid("CON"), permission: "all", granted: false, at: now }, ...state.consentLog],
        audit: audit(state, "customer", "consent.withdrawn", "All permissions withdrawn."),
      };
    case "upsert_goal": {
      const existing = action.goal.id ? state.goals.find((g) => g.id === action.goal.id) : undefined;
      const goal: FinancialGoal = existing
        ? { ...existing, ...action.goal, id: existing.id, saved: action.goal.saved ?? existing.saved }
        : { ...action.goal, id: uid("GOAL"), saved: action.goal.saved ?? 0, createdAt: now };
      const goals = existing ? state.goals.map((g) => (g.id === goal.id ? goal : g)) : [goal, ...state.goals];
      return {
        ...state,
        goals,
        activeGoalId: existing ? state.activeGoalId : goal.id,
        audit: audit(state, "customer", existing ? "goal.updated" : "goal.created", goal.label),
      };
    }
    case "delete_goal": {
      const goals = state.goals.filter((g) => g.id !== action.id);
      return {
        ...state,
        goals,
        activeGoalId: state.activeGoalId === action.id ? (goals[0]?.id ?? null) : state.activeGoalId,
        audit: audit(state, "customer", "goal.deleted", action.id),
      };
    }
    case "set_active_goal":
      return { ...state, activeGoalId: action.id };
    case "contribute":
      return {
        ...state,
        goals: state.goals.map((g) => (g.id === action.id ? { ...g, saved: Math.max(0, g.saved + action.amount) } : g)),
      };
    case "set_preferences":
      return {
        ...state,
        preferences: action.preferences,
        audit: audit(state, "customer", "preferences.updated", `Frequency: ${action.preferences.frequency}.`),
      };
    case "record_recommendation": {
      const rec: RecommendationRecord = { ...action.record, id: uid("REC"), created_at: now, status: "recommended" };
      return {
        ...state,
        recommendations: [rec, ...state.recommendations],
        audit: audit(state, "system", "recommendation.issued", `${rec.product_name} for ${rec.customer_id} (match ${rec.match_score}, need ${rec.need ?? "—"}).`),
      };
    }
    case "set_recommendation_status":
      return {
        ...state,
        recommendations: state.recommendations.map((r) =>
          r.id === action.id && r.status !== "applied" ? { ...r, status: action.status } : r,
        ),
      };
    case "feedback": {
      const status: RecommendationStatus | null =
        action.feedback === "remind_later"
          ? "snoozed"
          : action.feedback === "not_relevant" || action.feedback === "not_wanted"
            ? "dismissed"
            : null;
      return {
        ...state,
        recommendations: state.recommendations.map((r) =>
          r.id === action.id
            ? {
                ...r,
                feedback: action.feedback,
                feedback_at: now,
                status: status ?? r.status,
                snoozed_until:
                  action.feedback === "remind_later"
                    ? new Date(Date.now() + REMIND_LATER_DAYS * 86_400_000).toISOString()
                    : r.snoozed_until,
              }
            : r,
        ),
        audit: audit(state, "customer", "recommendation.feedback", `${action.id}: ${action.feedback}.`),
      };
    }
    case "apply":
      return {
        ...state,
        applications: [
          // Browser-only demo: the hand-off to Zenith is simulated, like the server's demo adapter.
          { id: uid("APP"), productId: action.productId, productName: action.productName, at: now, status: "submitted", handoff: "handed_off", reference: `DEMO-${uid("R").slice(-8).toUpperCase()}` },
          ...state.applications,
        ],
        recommendations: state.recommendations.map((r) =>
          r.product_id === action.productId ? { ...r, status: "applied" } : r,
        ),
        audit: audit(state, "customer", "product.application_started", action.productName),
      };
    case "set_product_status": {
      const prev = state.products.find((p) => p.product_id === action.productId);
      if (!prev || prev.status === action.status) return state;
      const product: Product = { ...prev, status: action.status, version: prev.version + 1, updated_at: now };
      return {
        ...state,
        products: state.products.map((p) => (p.product_id === product.product_id ? product : p)),
        productVersions: [prev, ...state.productVersions],
        audit: audit(state, "admin", "product.status_changed", `${product.name} → ${product.status} (v${product.version}).`),
      };
    }
    case "simulate_event":
      return simulateEvent(state, action.event, now);
    case "read_notification":
      return { ...state, notifications: state.notifications.map((n) => (n.id === action.id && !n.read_at ? { ...n, read_at: now } : n)) };
    case "set_simulate_error":
      return { ...state, simulateError: action.value };
    case "reset":
      return initialState();
    case "hydrate": {
      const s = action.snapshot;
      return {
        ...state,
        ...s,
        onboarded: state.onboarded || Object.values(s.permissions).some(Boolean) || s.goals.length > 0,
        syncError: null,
      };
    }
    case "sync_error":
      return { ...state, syncError: action.message };
  }
}

/**
 * Step 3, browser-only mode: money arrives, MoneyMap takes a fresh look and decides whether to say anything.
 * Mirrors POST /demo/events on the server (same pure functions); in API mode the server's answer replaces this.
 */
function simulateEvent(state: AppState, kind: "income" | "windfall", now: string): AppState {
  const before = profileFor(state.customerId, state.liveTransactions);
  const tx = simulatedCredit(kind, before, DEMO_TODAY, uid("LIVE"));
  const liveTransactions = [...state.liveTransactions, tx];
  const next = { ...state, liveTransactions };
  const trigger = detectTrigger(tx, before);
  if (!trigger) return next;
  const goal = state.goals.find((g) => g.id === state.activeGoalId) ?? state.goals[0] ?? null;
  const result = runEngine({
    customer: profileFor(state.customerId, liveTransactions),
    permissions: state.permissions,
    goal,
    preferences: state.preferences,
    products: state.products,
    history: state.recommendations,
    trigger,
  });
  const decision = decideOnTrigger({
    trigger,
    permissions: state.permissions,
    result,
    history: state.recommendations,
    notifications: state.notifications,
    now: new Date(now),
  });
  const eventId = uid("EVT");
  let recommendations = state.recommendations;
  let notification: AppNotification | null = null;
  if (decision.outcome === "notified" && result.top) {
    const p = result.top.product;
    let rec = recommendations.find((h) => h.product_id === p.product_id && !h.feedback && h.status !== "applied");
    if (!rec) {
      rec = { ...toRecord(result, state.customerId)!, id: uid("REC"), created_at: now, status: "recommended" };
      recommendations = [rec, ...recommendations];
    }
    notification = {
      id: uid("NTF"),
      customer_id: state.customerId,
      event_id: eventId,
      kind: decision.kind,
      title: decision.title,
      body: decision.body,
      product_id: p.product_id,
      product_name: p.name,
      recommendation_id: rec.id,
      created_at: now,
    };
  }
  const event: TriggerEvent = {
    ...trigger,
    id: eventId,
    customer_id: state.customerId,
    transaction_id: tx.id,
    created_at: now,
    outcome: decision.outcome,
    reason: decision.reason,
    ...(notification ? { notification_id: notification.id } : {}),
  };
  return {
    ...next,
    recommendations,
    notifications: notification ? [notification, ...state.notifications] : state.notifications,
    triggerEvents: [event, ...state.triggerEvents],
    audit: audit(state, "system", `trigger.${decision.outcome}`, `${trigger.description} ${trigger.amount} — ${decision.reason}`),
  };
}

interface Store {
  state: AppState;
  dispatch: (action: Action) => void;
  customer: CustomerProfile;
  activeGoal: FinancialGoal | null;
  /** Resolves once every queued server write has finished (API mode). */
  synced: () => Promise<unknown>;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, localDispatch] = useReducer(reducer, undefined, load);
  const stateRef = useRef(state);
  stateRef.current = state;
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  // In API mode every change is applied locally at once, then sent to the server in order;
  // the server's answer replaces the local copy.
  const dispatch = useCallback((action: Action) => {
    const prev = stateRef.current;
    localDispatch(action);
    if (!API_MODE || action.type === "hydrate" || action.type === "sync_error") return;
    queue.current = queue.current
      .then(() => syncAction(action, prev))
      .then((snapshot) => snapshot && localDispatch({ type: "hydrate", snapshot }))
      .catch((e: Error) => {
        if (e instanceof HttpError && e.status === 401) http.clearSession();
        localDispatch({
          type: "sync_error",
          message:
            e instanceof HttpError && e.status === 401
              ? "Your demo session has expired. Choose a customer again from Demo Mode."
              : `Couldn't reach the MoneyMap server: ${e.message}`,
        });
      });
  }, []);

  // API mode: load the server's copy on start.
  useEffect(() => {
    if (!API_MODE || !http.hasSession()) return;
    http
      .snapshot()
      .then((snapshot) => localDispatch({ type: "hydrate", snapshot }))
      .catch((e: Error) => {
        if (e instanceof HttpError && e.status === 401) http.clearSession();
        localDispatch({ type: "sync_error", message: "Couldn't load your MoneyMap from the server. Choose a customer again from Demo Mode." });
      });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore — persistence is a convenience only */
    }
  }, [state]);

  const customer = useMemo(() => profileFor(state.customerId, state.liveTransactions), [state.customerId, state.liveTransactions]);
  const value = useMemo<Store>(() => {
    const activeGoal = state.goals.find((g) => g.id === state.activeGoalId) ?? state.goals[0] ?? null;
    return { state, dispatch, customer, activeGoal, synced: () => queue.current.catch(() => undefined) };
  }, [state, dispatch, customer]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
