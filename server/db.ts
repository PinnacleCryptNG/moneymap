// Persistence for the MoneyMap API — SQLite via Node's built-in `node:sqlite` (no native deps).
// The schema mirrors the PRD's entity list and is written to port to PostgreSQL unchanged in spirit.
import { createHash, randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { CUSTOMERS } from "../src/data/customers";
import { DEFAULT_PREFERENCES } from "../src/data/defaults";
import { SEED_PRODUCTS } from "../src/data/products";
import type {
  Application,
  ConsentRecord,
  CustomerProfile,
  FeedbackType,
  FinancialGoal,
  GoalDraft,
  PermissionKey,
  Permissions,
  Preferences,
  Product,
  RecommendationRecord,
  RecommendationStatus,
} from "../src/types";

export const PERMISSION_KEYS: PermissionKey[] = [
  "account_activity",
  "income_patterns",
  "spending_patterns",
  "existing_products",
  "financial_goals",
];

const SCHEMA = `
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  profile_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS consents (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  permission TEXT NOT NULL,
  granted INTEGER NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (customer_id, permission)
);
CREATE TABLE IF NOT EXISTS consent_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  permission TEXT NOT NULL,
  granted INTEGER NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  amount INTEGER NOT NULL,
  timeline_months INTEGER NOT NULL,
  saved INTEGER NOT NULL DEFAULT 0,
  expense_kind TEXT,
  active INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id),
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  version INTEGER NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_versions (
  product_id TEXT NOT NULL,
  version INTEGER NOT NULL,
  data_json TEXT NOT NULL,
  replaced_at TEXT NOT NULL,
  PRIMARY KEY (product_id, version)
);
CREATE TABLE IF NOT EXISTS recommendations (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  category TEXT NOT NULL,
  need TEXT,
  match_score INTEGER NOT NULL,
  reasons_json TEXT NOT NULL,
  timing_reason TEXT NOT NULL,
  eligibility_status TEXT NOT NULL,
  model_version TEXT NOT NULL,
  status TEXT NOT NULL,
  feedback TEXT,
  feedback_at TEXT,
  snoozed_until TEXT,
  explanation_json TEXT NOT NULL,
  trace_json TEXT NOT NULL,
  factors_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS recommendations_customer ON recommendations(customer_id, created_at);
CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  status TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
`;

export type Db = ReturnType<typeof openDb>;

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "").slice(0, 16).toUpperCase()}`;

interface RecommendationRow {
  id: string;
  customer_id: string;
  product_id: string;
  product_name: string;
  category: string;
  need: string | null;
  match_score: number;
  reasons_json: string;
  timing_reason: string;
  eligibility_status: string;
  model_version: string;
  status: string;
  feedback: string | null;
  feedback_at: string | null;
  snoozed_until: string | null;
  explanation_json: string;
  trace_json: string;
  factors_json: string;
  created_at: string;
}

function toRecommendation(r: RecommendationRow): RecommendationRecord {
  return {
    id: r.id,
    customer_id: r.customer_id,
    product_id: r.product_id,
    product_name: r.product_name,
    category: r.category as RecommendationRecord["category"],
    need: r.need as RecommendationRecord["need"],
    match_score: r.match_score,
    reasons: JSON.parse(r.reasons_json),
    timing_reason: r.timing_reason,
    eligibility_status: r.eligibility_status as RecommendationRecord["eligibility_status"],
    model_version: r.model_version,
    status: r.status as RecommendationStatus,
    feedback: (r.feedback ?? undefined) as FeedbackType | undefined,
    feedback_at: r.feedback_at ?? undefined,
    snoozed_until: r.snoozed_until ?? undefined,
    created_at: r.created_at,
  };
}

interface GoalRow {
  id: string;
  customer_id: string;
  type: string;
  label: string;
  amount: number;
  timeline_months: number;
  saved: number;
  expense_kind: string | null;
  active: number;
  created_at: string;
}

function toGoal(r: GoalRow): FinancialGoal & { active: boolean } {
  return {
    id: r.id,
    type: r.type as FinancialGoal["type"],
    label: r.label,
    amount: r.amount,
    timelineMonths: r.timeline_months,
    saved: r.saved,
    expenseKind: (r.expense_kind ?? undefined) as FinancialGoal["expenseKind"],
    createdAt: r.created_at,
    active: r.active === 1,
  };
}

export function openDb(path = process.env.MONEYMAP_DB ?? "data/moneymap.db") {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);

  const tx = <T>(fn: () => T): T => {
    db.exec("BEGIN");
    try {
      const out = fn();
      db.exec("COMMIT");
      return out;
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
  };

  // ---- Audit log (hash-chained: each entry commits to the one before it) ----
  function audit(actor: "customer" | "admin" | "system", action: string, detail: string) {
    const prev = db.prepare("SELECT hash FROM audit_log ORDER BY seq DESC LIMIT 1").get() as { hash: string } | undefined;
    const prevHash = prev?.hash ?? "GENESIS";
    const at = now();
    const hash = createHash("sha256").update(`${prevHash}|${at}|${actor}|${action}|${detail}`).digest("hex");
    db.prepare("INSERT INTO audit_log (at, actor, action, detail, prev_hash, hash) VALUES (?, ?, ?, ?, ?, ?)").run(at, actor, action, detail, prevHash, hash);
  }

  function auditLog(limit = 200) {
    return db.prepare("SELECT seq, at, actor, action, detail, prev_hash, hash FROM audit_log ORDER BY seq DESC LIMIT ?").all(limit) as {
      seq: number;
      at: string;
      actor: string;
      action: string;
      detail: string;
      prev_hash: string;
      hash: string;
    }[];
  }

  /** Recompute the chain; returns the first broken sequence number, or null if intact. */
  function verifyAudit(): { intact: boolean; entries: number; brokenAt: number | null } {
    const rows = db.prepare("SELECT seq, at, actor, action, detail, prev_hash, hash FROM audit_log ORDER BY seq ASC").all() as {
      seq: number;
      at: string;
      actor: string;
      action: string;
      detail: string;
      prev_hash: string;
      hash: string;
    }[];
    let prev = "GENESIS";
    for (const r of rows) {
      const expected = createHash("sha256").update(`${prev}|${r.at}|${r.actor}|${r.action}|${r.detail}`).digest("hex");
      if (r.prev_hash !== prev || r.hash !== expected) return { intact: false, entries: rows.length, brokenAt: r.seq };
      prev = r.hash;
    }
    return { intact: true, entries: rows.length, brokenAt: null };
  }

  // ---- Seeding ----
  function seed() {
    tx(() => {
      const t = now();
      for (const c of CUSTOMERS) {
        db.prepare("INSERT OR IGNORE INTO customers (id, profile_json, created_at) VALUES (?, ?, ?)").run(c.id, JSON.stringify(c), t);
        for (const p of PERMISSION_KEYS) {
          db.prepare("INSERT OR IGNORE INTO consents (customer_id, permission, granted, updated_at) VALUES (?, ?, 0, ?)").run(c.id, p, t);
        }
        db.prepare("INSERT OR IGNORE INTO preferences (customer_id, json) VALUES (?, ?)").run(c.id, JSON.stringify(DEFAULT_PREFERENCES));
      }
      for (const p of SEED_PRODUCTS) {
        db.prepare("INSERT OR IGNORE INTO products (product_id, version, status, data_json, updated_at) VALUES (?, ?, ?, ?, ?)").run(
          p.product_id,
          p.version,
          p.status,
          JSON.stringify(p),
          p.updated_at,
        );
      }
    });
    if (!(db.prepare("SELECT 1 FROM audit_log LIMIT 1").get())) audit("system", "system.seeded", `${CUSTOMERS.length} customers, ${SEED_PRODUCTS.length} products.`);
  }

  /** Clear one customer's activity (Demo Mode) or everything. */
  function resetCustomer(customerId: string) {
    tx(() => {
      db.prepare("DELETE FROM recommendations WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM applications WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM goals WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM consent_events WHERE customer_id = ?").run(customerId);
      db.prepare("UPDATE consents SET granted = 0, updated_at = ? WHERE customer_id = ?").run(now(), customerId);
      db.prepare("UPDATE preferences SET json = ? WHERE customer_id = ?").run(JSON.stringify(DEFAULT_PREFERENCES), customerId);
    });
    audit("system", "demo.customer_reset", customerId);
  }

  function resetAll() {
    tx(() => {
      for (const t of ["recommendations", "applications", "goals", "consent_events", "consents", "preferences", "product_versions", "products", "customers", "audit_log"]) {
        db.exec(`DELETE FROM ${t}`);
      }
    });
    seed();
  }

  // ---- Customers ----
  function getCustomer(customerId: string): CustomerProfile | null {
    const row = db.prepare("SELECT profile_json FROM customers WHERE id = ?").get(customerId) as { profile_json: string } | undefined;
    return row ? (JSON.parse(row.profile_json) as CustomerProfile) : null;
  }

  function listCustomers(): CustomerProfile[] {
    return (db.prepare("SELECT profile_json FROM customers ORDER BY id").all() as { profile_json: string }[]).map((r) => JSON.parse(r.profile_json));
  }

  // ---- Consent ----
  function getPermissions(customerId: string): Permissions {
    const rows = db.prepare("SELECT permission, granted FROM consents WHERE customer_id = ?").all(customerId) as { permission: PermissionKey; granted: number }[];
    const out = Object.fromEntries(PERMISSION_KEYS.map((k) => [k, false])) as Permissions;
    for (const r of rows) out[r.permission] = r.granted === 1;
    return out;
  }

  function setPermissions(customerId: string, changes: Partial<Permissions>): Permissions {
    const t = now();
    const current = getPermissions(customerId);
    const changed: string[] = [];
    tx(() => {
      for (const k of PERMISSION_KEYS) {
        const v = changes[k];
        if (v === undefined || v === current[k]) continue;
        db.prepare("UPDATE consents SET granted = ?, updated_at = ? WHERE customer_id = ? AND permission = ?").run(v ? 1 : 0, t, customerId, k);
        db.prepare("INSERT INTO consent_events (id, customer_id, permission, granted, at) VALUES (?, ?, ?, ?, ?)").run(id("CON"), customerId, k, v ? 1 : 0, t);
        changed.push(`${k}=${v ? "granted" : "withdrawn"}`);
      }
    });
    if (changed.length) audit("customer", "consent.updated", `${customerId}: ${changed.join(", ")}`);
    return getPermissions(customerId);
  }

  function consentHistory(customerId: string): ConsentRecord[] {
    return (db.prepare("SELECT id, permission, granted, at FROM consent_events WHERE customer_id = ? ORDER BY at DESC").all(customerId) as {
      id: string;
      permission: PermissionKey;
      granted: number;
      at: string;
    }[]).map((r) => ({ id: r.id, permission: r.permission, granted: r.granted === 1, at: r.at }));
  }

  // ---- Goals ----
  function listGoals(customerId: string) {
    return (db.prepare("SELECT * FROM goals WHERE customer_id = ? ORDER BY created_at DESC").all(customerId) as unknown as GoalRow[]).map(toGoal);
  }

  function activeGoal(customerId: string): FinancialGoal | null {
    const goals = listGoals(customerId);
    return goals.find((g) => g.active) ?? goals[0] ?? null;
  }

  function createGoal(customerId: string, g: GoalDraft, makeActive = true) {
    const goalId = id("GOAL");
    tx(() => {
      if (makeActive) db.prepare("UPDATE goals SET active = 0 WHERE customer_id = ?").run(customerId);
      db.prepare(
        "INSERT INTO goals (id, customer_id, type, label, amount, timeline_months, saved, expense_kind, active, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(goalId, customerId, g.type, g.label, g.amount, g.timelineMonths, g.saved ?? 0, g.expenseKind ?? null, makeActive ? 1 : 0, now());
    });
    audit("customer", "goal.created", `${customerId}: ${g.label}`);
    return listGoals(customerId).find((x) => x.id === goalId)!;
  }

  function updateGoal(customerId: string, goalId: string, patch: Partial<GoalDraft> & { active?: boolean }) {
    const existing = listGoals(customerId).find((g) => g.id === goalId);
    if (!existing) return null;
    const next = { ...existing, ...patch };
    tx(() => {
      if (patch.active) db.prepare("UPDATE goals SET active = 0 WHERE customer_id = ?").run(customerId);
      db.prepare(
        "UPDATE goals SET type = ?, label = ?, amount = ?, timeline_months = ?, saved = ?, expense_kind = ?, active = ? WHERE id = ? AND customer_id = ?",
      ).run(next.type, next.label, next.amount, next.timelineMonths, next.saved, next.expenseKind ?? null, next.active ? 1 : 0, goalId, customerId);
    });
    audit("customer", "goal.updated", `${customerId}: ${next.label}`);
    return listGoals(customerId).find((g) => g.id === goalId)!;
  }

  function deleteGoal(customerId: string, goalId: string) {
    const res = db.prepare("DELETE FROM goals WHERE id = ? AND customer_id = ?").run(goalId, customerId);
    if (res.changes) audit("customer", "goal.deleted", `${customerId}: ${goalId}`);
    return res.changes > 0;
  }

  // ---- Preferences ----
  function getPreferences(customerId: string): Preferences {
    const row = db.prepare("SELECT json FROM preferences WHERE customer_id = ?").get(customerId) as { json: string } | undefined;
    return row ? JSON.parse(row.json) : DEFAULT_PREFERENCES;
  }

  function setPreferences(customerId: string, prefs: Preferences) {
    db.prepare("INSERT INTO preferences (customer_id, json) VALUES (?, ?) ON CONFLICT(customer_id) DO UPDATE SET json = excluded.json").run(customerId, JSON.stringify(prefs));
    audit("customer", "preferences.updated", `${customerId}: frequency=${prefs.frequency}`);
    return getPreferences(customerId);
  }

  // ---- Products ----
  function listProducts(): Product[] {
    return (db.prepare("SELECT data_json, version, status, updated_at FROM products ORDER BY product_id").all() as {
      data_json: string;
      version: number;
      status: Product["status"];
      updated_at: string;
    }[]).map((r) => ({ ...JSON.parse(r.data_json), version: r.version, status: r.status, updated_at: r.updated_at }));
  }

  function getProduct(productId: string): Product | null {
    return listProducts().find((p) => p.product_id === productId) ?? null;
  }

  function setProductStatus(productId: string, status: Product["status"]) {
    const prev = getProduct(productId);
    if (!prev) return null;
    if (prev.status === status) return prev;
    const t = now();
    const next: Product = { ...prev, status, version: prev.version + 1, updated_at: t };
    tx(() => {
      db.prepare("INSERT INTO product_versions (product_id, version, data_json, replaced_at) VALUES (?, ?, ?, ?)").run(prev.product_id, prev.version, JSON.stringify(prev), t);
      db.prepare("UPDATE products SET version = ?, status = ?, data_json = ?, updated_at = ? WHERE product_id = ?").run(next.version, status, JSON.stringify(next), t, productId);
    });
    audit("admin", "product.status_changed", `${next.name} → ${status} (v${next.version})`);
    return next;
  }

  function productVersions(productId: string) {
    return db.prepare("SELECT version, replaced_at FROM product_versions WHERE product_id = ? ORDER BY version DESC").all(productId) as { version: number; replaced_at: string }[];
  }

  // ---- Recommendations ----
  function listRecommendations(customerId?: string): RecommendationRecord[] {
    const rows = customerId
      ? db.prepare("SELECT * FROM recommendations WHERE customer_id = ? ORDER BY created_at DESC").all(customerId)
      : db.prepare("SELECT * FROM recommendations ORDER BY created_at DESC").all();
    return (rows as unknown as RecommendationRow[]).map(toRecommendation);
  }

  function getRecommendationRow(recId: string) {
    return db.prepare("SELECT * FROM recommendations WHERE id = ?").get(recId) as RecommendationRow | undefined;
  }

  function getRecommendation(recId: string) {
    const row = getRecommendationRow(recId);
    if (!row) return null;
    return {
      record: toRecommendation(row),
      explanation: JSON.parse(row.explanation_json),
      trace: JSON.parse(row.trace_json),
      factors: JSON.parse(row.factors_json),
    };
  }

  function insertRecommendation(
    rec: Omit<RecommendationRecord, "id" | "created_at" | "status">,
    snapshot: { explanation: unknown; trace: unknown; factors: unknown },
  ): RecommendationRecord {
    const recId = id("REC");
    db.prepare(
      `INSERT INTO recommendations (id, customer_id, product_id, product_name, category, need, match_score, reasons_json, timing_reason,
        eligibility_status, model_version, status, explanation_json, trace_json, factors_json, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'recommended', ?, ?, ?, ?)`,
    ).run(
      recId,
      rec.customer_id,
      rec.product_id,
      rec.product_name,
      rec.category,
      rec.need,
      rec.match_score,
      JSON.stringify(rec.reasons),
      rec.timing_reason,
      rec.eligibility_status,
      rec.model_version,
      JSON.stringify(snapshot.explanation),
      JSON.stringify(snapshot.trace),
      JSON.stringify(snapshot.factors),
      now(),
    );
    audit("system", "recommendation.issued", `${rec.customer_id}: ${rec.product_name} (match ${rec.match_score}, need ${rec.need ?? "—"}, ${rec.model_version})`);
    return getRecommendation(recId)!.record;
  }

  function recordFeedback(recId: string, feedback: FeedbackType, remindLaterDays: number) {
    const row = getRecommendationRow(recId);
    if (!row) return null;
    const t = now();
    const status: RecommendationStatus =
      feedback === "remind_later" ? "snoozed" : feedback === "not_relevant" || feedback === "not_wanted" ? "dismissed" : (row.status as RecommendationStatus);
    const snoozed = feedback === "remind_later" ? new Date(Date.now() + remindLaterDays * 86_400_000).toISOString() : row.snoozed_until;
    db.prepare("UPDATE recommendations SET feedback = ?, feedback_at = ?, status = ?, snoozed_until = ? WHERE id = ?").run(feedback, t, status, snoozed, recId);
    audit("customer", "recommendation.feedback", `${row.customer_id}: ${row.product_name} → ${feedback}`);
    return getRecommendation(recId)!.record;
  }

  function setRecommendationStatus(recId: string, status: RecommendationStatus) {
    db.prepare("UPDATE recommendations SET status = ? WHERE id = ? AND status != 'applied'").run(status, recId);
  }

  // ---- Applications ----
  function createApplication(customerId: string, product: Product): Application {
    const app: Application = { id: id("APP"), productId: product.product_id, productName: product.name, at: now(), status: "submitted" };
    tx(() => {
      db.prepare("INSERT INTO applications (id, customer_id, product_id, product_name, status, at) VALUES (?, ?, ?, ?, ?, ?)").run(
        app.id,
        customerId,
        app.productId,
        app.productName,
        app.status,
        app.at,
      );
      db.prepare("UPDATE recommendations SET status = 'applied' WHERE customer_id = ? AND product_id = ?").run(customerId, product.product_id);
    });
    audit("customer", "product.request_submitted", `${customerId}: ${product.name}`);
    return app;
  }

  function listApplications(customerId: string): Application[] {
    return (db.prepare("SELECT id, product_id, product_name, status, at FROM applications WHERE customer_id = ? ORDER BY at DESC").all(customerId) as {
      id: string;
      product_id: string;
      product_name: string;
      status: "submitted";
      at: string;
    }[]).map((r) => ({ id: r.id, productId: r.product_id, productName: r.product_name, status: r.status, at: r.at }));
  }

  seed();

  return {
    raw: db,
    close: () => db.close(),
    audit,
    auditLog,
    verifyAudit,
    resetCustomer,
    resetAll,
    getCustomer,
    listCustomers,
    getPermissions,
    setPermissions,
    consentHistory,
    listGoals,
    activeGoal,
    createGoal,
    updateGoal,
    deleteGoal,
    getPreferences,
    setPreferences,
    listProducts,
    getProduct,
    setProductStatus,
    productVersions,
    listRecommendations,
    getRecommendation,
    insertRecommendation,
    recordFeedback,
    setRecommendationStatus,
    createApplication,
    listApplications,
  };
}
