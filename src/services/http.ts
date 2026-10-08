// HTTP client for the MoneyMap API. Used when the app is built with VITE_API_MODE=http.
import type { EngineResult, Evaluation } from "../engine";
import type {
  Application,
  ConsentRecord,
  FeedbackType,
  FinancialGoal,
  GoalDraft,
  Permissions,
  Preferences,
  Product,
  RecommendationRecord,
} from "../types";

export const API_MODE = import.meta.env.VITE_API_MODE === "http";
const BASE = (import.meta.env.VITE_API_URL ?? "") + "/api/v1";
const TOKEN_KEY = "moneymap:token";
const ADMIN_KEY = "moneymap:admin-token";

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable — session lasts until reload */
  }
}

let token = read(TOKEN_KEY);
let adminToken = read(ADMIN_KEY);

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown, as: "customer" | "admin" | "none" = "customer"): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers["content-type"] = "application/json";
  if (as === "admin") {
    if (!adminToken) {
      const r = await call<{ token: string }>("POST", "/auth/demo-login", { role: "admin" }, "none");
      adminToken = r.token;
      write(ADMIN_KEY, adminToken);
    }
    headers.authorization = `Bearer ${adminToken}`;
  } else if (as === "customer" && token) {
    headers.authorization = `Bearer ${token}`;
  }
  const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status, data.message ?? `Request failed (${res.status})`);
  return data as T;
}

interface GoalOut {
  id: string;
  type: FinancialGoal["type"];
  label: string;
  amount: number;
  timeline_months: number;
  saved: number;
  expense_kind: FinancialGoal["expenseKind"] | null;
  active: boolean;
  created_at: string;
}

const toGoal = (g: GoalOut): FinancialGoal & { active: boolean } => ({
  id: g.id,
  type: g.type,
  label: g.label,
  amount: g.amount,
  timelineMonths: g.timeline_months,
  saved: g.saved,
  expenseKind: g.expense_kind ?? undefined,
  createdAt: g.created_at,
  active: g.active,
});

const goalBody = (g: Partial<GoalDraft> & { active?: boolean }) => ({
  ...(g.type && { type: g.type }),
  ...(g.label && { label: g.label }),
  ...(g.amount !== undefined && { amount: Math.round(g.amount) }),
  ...(g.timelineMonths !== undefined && { timeline_months: g.timelineMonths }),
  ...(g.saved !== undefined && { saved: Math.round(g.saved) }),
  ...(g.expenseKind && { expense_kind: g.expenseKind }),
  ...(g.active !== undefined && { active: g.active }),
});

export interface ServerSnapshot {
  permissions: Permissions;
  consentLog: ConsentRecord[];
  goals: FinancialGoal[];
  activeGoalId: string | null;
  preferences: Preferences;
  recommendations: RecommendationRecord[];
  applications: Application[];
  products: Product[];
}

export const http = {
  hasSession: () => Boolean(token),

  async startSession(customerId: string, preload: boolean) {
    const r = await call<{ token: string }>("POST", "/demo/session", { customer_id: customerId, preload }, "none");
    token = r.token;
    write(TOKEN_KEY, token);
  },

  clearSession() {
    token = null;
    write(TOKEN_KEY, null);
  },

  async snapshot(): Promise<ServerSnapshot> {
    const [consent, goals, preferences, recommendations, applications, products] = await Promise.all([
      call<{ permissions: Permissions; history: ConsentRecord[] }>("GET", "/consent"),
      call<GoalOut[]>("GET", "/goals"),
      call<Preferences>("GET", "/preferences"),
      call<RecommendationRecord[]>("GET", "/recommendations"),
      call<Application[]>("GET", "/applications"),
      call<Product[]>("GET", "/products", undefined, "none"),
    ]);
    const g = goals.map(toGoal);
    return {
      permissions: consent.permissions,
      consentLog: consent.history,
      goals: g,
      activeGoalId: g.find((x) => x.active)?.id ?? g[0]?.id ?? null,
      preferences,
      recommendations,
      applications,
      products,
    };
  },

  setConsent: (p: Partial<Permissions>) => call("POST", "/consent", p),
  createGoal: (g: GoalDraft) => call<GoalOut>("POST", "/goals", { ...goalBody(g), amount: Math.round(g.amount), active: true }),
  updateGoal: (goalId: string, g: Partial<GoalDraft> & { active?: boolean }) => call<GoalOut>("PATCH", `/goals/${goalId}`, goalBody(g)),
  deleteGoal: (goalId: string) => call("DELETE", `/goals/${goalId}`),
  setPreferences: (p: Preferences) => call("PATCH", "/preferences", p),

  recommend: (requestedMore: boolean) =>
    call<{ recommendation: RecommendationRecord | null; engine: EngineResult }>("POST", "/recommendations", { requested_more: requestedMore }),
  feedback: (recId: string, feedback: FeedbackType) => call("POST", `/recommendations/${recId}/feedback`, { feedback }),
  explored: (recId: string) => call("POST", `/recommendations/${recId}/explored`, {}),
  eligibility: (productId: string) =>
    call<{ eligibility: Evaluation["eligibility"] }>("POST", `/products/${productId}/eligibility-check`, {}),
  apply: (productId: string) => call<Application>("POST", `/products/${productId}/apply`, {}),

  adminMetrics: () => call<{ live: Record<string, unknown> }>("GET", "/admin/metrics", undefined, "admin"),
  adminAudit: () =>
    call<{
      integrity: { intact: boolean; entries: number; brokenAt: number | null };
      entries: { seq: number; at: string; actor: string; action: string; detail: string; hash: string }[];
    }>("GET", "/admin/audit", undefined, "admin"),
  setProductStatus: (productId: string, status: Product["status"]) => call("PATCH", `/admin/products/${productId}`, { status }, "admin"),
  resetAll: () => call("POST", "/demo/reset", {}, "admin"),
};
