import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from "react";
import { getCustomer } from "../../data/customers";
import { DEFAULT_PREFERENCES } from "../../data/defaults";
import { SEED_PRODUCTS } from "../../data/products";
import type {
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
  RecommendationStatus,
} from "../../types";
import { uid } from "../../utils/format";

export interface AppState {
  schema: 3;
  customerId: string;
  onboarded: boolean;
  permissions: Permissions;
  consentLog: ConsentRecord[];
  goals: FinancialGoal[];
  activeGoalId: string | null;
  preferences: Preferences;
  recommendations: RecommendationRecord[];
  applications: Application[];
  products: Product[];
  productVersions: Product[];
  audit: AuditEntry[];
  simulateError: boolean;
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
  "customerId" | "onboarded" | "permissions" | "consentLog" | "goals" | "activeGoalId" | "preferences" | "recommendations" | "applications"
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
  };
}

function initialState(): AppState {
  return {
    schema: 3,
    ...customerState("CUST_001"),
    products: SEED_PRODUCTS,
    productVersions: [],
    audit: [],
    simulateError: false,
  };
}

const STORAGE_KEY = "moneymap:v3";

function load(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed.schema === 3) return parsed;
    }
  } catch {
    /* storage unavailable — fall back to defaults */
  }
  return initialState();
}

export type Action =
  | { type: "select_customer"; customerId: string }
  | { type: "complete_onboarding"; permissions: Permissions; goal: GoalDraft | null }
  | { type: "set_permission"; key: PermissionKey; granted: boolean }
  | { type: "withdraw_all" }
  | { type: "upsert_goal"; goal: GoalDraft & { id?: string } }
  | { type: "delete_goal"; id: string }
  | { type: "set_active_goal"; id: string }
  | { type: "contribute"; id: string; amount: number }
  | { type: "set_preferences"; preferences: Preferences }
  | { type: "record_recommendation"; record: Omit<RecommendationRecord, "id" | "createdAt" | "status"> }
  | { type: "set_recommendation_status"; id: string; status: RecommendationStatus }
  | { type: "feedback"; id: string; feedback: FeedbackType }
  | { type: "apply"; productId: string; productName: string }
  | { type: "upsert_product"; product: Product }
  | { type: "set_simulate_error"; value: boolean }
  | { type: "reset" };

function audit(state: AppState, actor: AuditEntry["actor"], action: string, detail: string): AuditEntry[] {
  return [{ id: uid("AUD"), at: new Date().toISOString(), actor, action, detail }, ...state.audit].slice(0, 300);
}

const REMIND_LATER_DAYS = 3;

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
      const rec: RecommendationRecord = { ...action.record, id: uid("REC"), createdAt: now, status: "recommended" };
      return {
        ...state,
        recommendations: [rec, ...state.recommendations],
        audit: audit(state, "system", "recommendation.issued", `${rec.productName} (score ${rec.score}).`),
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
          : action.feedback === "not_relevant" || action.feedback === "dont_want"
            ? "dismissed"
            : null;
      return {
        ...state,
        recommendations: state.recommendations.map((r) =>
          r.id === action.id
            ? {
                ...r,
                feedback: action.feedback,
                feedbackAt: now,
                status: status ?? r.status,
                snoozedUntil:
                  action.feedback === "remind_later"
                    ? new Date(Date.now() + REMIND_LATER_DAYS * 86_400_000).toISOString()
                    : r.snoozedUntil,
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
          { id: uid("APP"), productId: action.productId, productName: action.productName, at: now, status: "submitted" },
          ...state.applications,
        ],
        recommendations: state.recommendations.map((r) =>
          r.productId === action.productId ? { ...r, status: "applied" } : r,
        ),
        audit: audit(state, "customer", "product.application_started", action.productName),
      };
    case "upsert_product": {
      const prev = state.products.find((p) => p.product_id === action.product.product_id);
      const product: Product = {
        ...action.product,
        version: prev ? prev.version + 1 : 1,
        updated_at: now,
      };
      return {
        ...state,
        products: prev
          ? state.products.map((p) => (p.product_id === product.product_id ? product : p))
          : [...state.products, product],
        productVersions: prev ? [prev, ...state.productVersions] : state.productVersions,
        audit: audit(
          state,
          "admin",
          prev ? "product.updated" : "product.created",
          `${product.name} → v${product.version}${prev && prev.status !== product.status ? ` (${product.status})` : ""}.`,
        ),
      };
    }
    case "set_simulate_error":
      return { ...state, simulateError: action.value };
    case "reset":
      return initialState();
  }
}

interface Store {
  state: AppState;
  dispatch: (action: Action) => void;
  customer: ReturnType<typeof getCustomer>;
  activeGoal: FinancialGoal | null;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, load);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore — persistence is a convenience only */
    }
  }, [state]);

  const value = useMemo<Store>(() => {
    const customer = getCustomer(state.customerId);
    const activeGoal = state.goals.find((g) => g.id === state.activeGoalId) ?? state.goals[0] ?? null;
    return { state, dispatch, customer, activeGoal };
  }, [state]);

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used inside StoreProvider");
  return ctx;
}
