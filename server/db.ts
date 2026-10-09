// Persistence for the MoneyMap API — SQLite via Node's built-in `node:sqlite` (no native deps).
// The schema mirrors the PRD's entity list and is written to port to PostgreSQL unchanged in spirit.
import { createHash, randomUUID } from "node:crypto";
import { fieldCipher, type FieldCipher } from "./fieldCrypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { PERSONA_BASES } from "../src/data/customers";
import { buildLedger, DEMO_TODAY } from "../src/data/ledgers";
import { deriveProfile } from "../src/engine/ledger";
import { DEFAULT_PREFERENCES } from "../src/data/defaults";
import { SEED_PRODUCTS } from "../src/data/products";
import type {
  Application,
  ConsentRecord,
  CustomerProfile,
  PersonaBase,
  RawTransaction,
  FeedbackType,
  FinancialGoal,
  GoalDraft,
  PermissionKey,
  Permissions,
  Preferences,
  Product,
  RecommendationRecord,
  RecommendationStatus,
  AppNotification,
  SelfReport,
  Trigger,
  TriggerEvent,
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
CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  date TEXT NOT NULL,
  narration TEXT NOT NULL,
  amount INTEGER NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  channel TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_customer ON transactions(customer_id, date);
CREATE TABLE IF NOT EXISTS trigger_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  transaction_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  description TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('notified', 'held_back')),
  reason TEXT NOT NULL,
  notification_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS page_views (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  count INTEGER NOT NULL,
  PRIMARY KEY (day, path)
);
CREATE TABLE IF NOT EXISTS self_reports (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id),
  json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS deliveries (
  notification_id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'delivered', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  channel TEXT,
  reference TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS statement_syncs (
  customer_id TEXT PRIMARY KEY,
  synced_at TEXT NOT NULL,
  status TEXT NOT NULL,
  lines INTEGER NOT NULL,
  error TEXT
);
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  event_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT NOT NULL,
  recommendation_id TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
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
CREATE TABLE IF NOT EXISTS financial_profiles (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id),
  income_avg INTEGER,
  income_stability TEXT,
  spending_avg INTEGER,
  recurring_commitments INTEGER,
  surplus_avg INTEGER,
  coverage REAL NOT NULL,
  permissions_json TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transaction_signals (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  signal TEXT NOT NULL,
  strength REAL NOT NULL,
  evidence TEXT NOT NULL,
  source_permission TEXT NOT NULL,
  computed_at TEXT NOT NULL,
  PRIMARY KEY (customer_id, signal)
);
CREATE TABLE IF NOT EXISTS product_eligibility (
  product_id TEXT NOT NULL REFERENCES products(product_id),
  condition TEXT NOT NULL,
  value TEXT NOT NULL,
  basis TEXT NOT NULL CHECK (basis IN ('published', 'guardrail')),
  source TEXT,
  PRIMARY KEY (product_id, condition)
);
CREATE TABLE IF NOT EXISTS model_versions (
  version TEXT PRIMARY KEY,
  weights_json TEXT NOT NULL,
  thresholds_json TEXT NOT NULL,
  description TEXT NOT NULL,
  first_used_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS recommendation_reasons (
  recommendation_id TEXT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  reason_key TEXT NOT NULL,
  label TEXT NOT NULL,
  detail TEXT NOT NULL,
  PRIMARY KEY (recommendation_id, position)
);
CREATE TABLE IF NOT EXISTS recommendation_feedback (
  id TEXT PRIMARY KEY,
  recommendation_id TEXT NOT NULL REFERENCES recommendations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  feedback TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_interactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  product_id TEXT NOT NULL REFERENCES products(product_id),
  recommendation_id TEXT,
  interaction TEXT NOT NULL CHECK (interaction IN ('viewed', 'explored', 'eligibility_checked', 'requested')),
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

type Open = (stored: string, where: string) => string;

function toRecommendation(r: RecommendationRow, open: Open): RecommendationRecord {
  return {
    id: r.id,
    customer_id: r.customer_id,
    product_id: r.product_id,
    product_name: r.product_name,
    category: r.category as RecommendationRecord["category"],
    need: r.need as RecommendationRecord["need"],
    match_score: r.match_score,
    reasons: JSON.parse(r.reasons_json),
    timing_reason: open(r.timing_reason, "recommendations.timing_reason"),
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

function toGoal(r: GoalRow, open: Open): FinancialGoal & { active: boolean } {
  return {
    id: r.id,
    type: r.type as FinancialGoal["type"],
    label: open(r.label, "goals.label"),
    amount: r.amount,
    timelineMonths: r.timeline_months,
    saved: r.saved,
    expenseKind: (r.expense_kind ?? undefined) as FinancialGoal["expenseKind"],
    createdAt: r.created_at,
    active: r.active === 1,
  };
}

export function openDb(path = process.env.MONEYMAP_DB ?? "data/moneymap.db", cipher: FieldCipher = fieldCipher()) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec(SCHEMA);
  // Step 4 columns on a database created before them.
  for (const col of ["reference TEXT", "handoff_status TEXT", "handoff_error TEXT"]) {
    try {
      db.exec(`ALTER TABLE applications ADD COLUMN ${col}`);
    } catch {
      /* already there */
    }
  }

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
      for (const c of PERSONA_BASES) {
        // Customers hold identity and KYC basics only; every financial figure is derived from their transactions.
        const fresh = db.prepare("INSERT OR IGNORE INTO customers (id, profile_json, created_at) VALUES (?, ?, ?)").run(c.id, JSON.stringify(c), t);
        if (fresh.changes) {
          for (const tr of buildLedger(c.id)) {
            db.prepare("INSERT INTO transactions (id, customer_id, date, narration, amount, direction, channel) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
              tr.id,
              c.id,
              tr.date,
              cipher.seal(tr.narration, "transactions.narration"),
              tr.amount,
              tr.direction,
              tr.channel,
            );
          }
        }
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
        const e = p.eligibility;
        const conditions: [string, string | number | boolean | string[] | undefined, "published" | "guardrail", string | undefined][] = [
          ["segments", e.segments, "published", e.source],
          ["minimum_age", e.minimum_age, "published", e.source],
          ["maximum_age", e.maximum_age, "published", e.source],
          ["salary_account_required", e.salary_account_required, "published", e.source],
          ["max_principal_to_income", p.suitability.max_principal_to_income, "guardrail", undefined],
          ["max_balance", p.suitability.max_balance, "guardrail", undefined],
        ];
        for (const [condition, value, basis, source] of conditions) {
          if (value === undefined) continue;
          db.prepare("INSERT OR IGNORE INTO product_eligibility (product_id, condition, value, basis, source) VALUES (?, ?, ?, ?, ?)").run(
            p.product_id,
            condition,
            JSON.stringify(value),
            basis,
            source ?? null,
          );
        }
      }
    });
    if (!(db.prepare("SELECT 1 FROM audit_log LIMIT 1").get())) audit("system", "system.seeded", `${PERSONA_BASES.length} customers, ${SEED_PRODUCTS.length} products.`);
  }

  /** Clear one customer's activity (Demo Mode) or everything. */
  /** NDPA right of erasure: remove everything MoneyMap itself holds about the customer. */
  function eraseCustomer(customerId: string) {
    resetCustomer(customerId);
    tx(() => {
      // MoneyMap's cached copy of bank lines goes too; the bank's own records stay with the bank.
      db.prepare("DELETE FROM transactions WHERE customer_id = ? AND id LIKE 'BANK_%'").run(customerId);
      db.prepare("DELETE FROM statement_syncs WHERE customer_id = ?").run(customerId);
    });
    audit("customer", "customer.data_erased", customerId);
  }

  function resetCustomer(customerId: string) {
    tx(() => {
      db.prepare("DELETE FROM recommendation_feedback WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM self_reports WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM deliveries WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM notifications WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM trigger_events WHERE customer_id = ?").run(customerId);
      // Lines that arrived live (bank feed or Demo Mode) go; the seeded six-month statement stays.
      db.prepare("DELETE FROM transactions WHERE customer_id = ? AND id LIKE 'LIVE_%'").run(customerId);
      db.prepare("DELETE FROM recommendation_reasons WHERE recommendation_id IN (SELECT id FROM recommendations WHERE customer_id = ?)").run(customerId);
      db.prepare("DELETE FROM product_interactions WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM transaction_signals WHERE customer_id = ?").run(customerId);
      db.prepare("DELETE FROM financial_profiles WHERE customer_id = ?").run(customerId);
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
      for (const t of ["self_reports", "deliveries", "statement_syncs", "notifications", "trigger_events", "recommendation_feedback", "recommendation_reasons", "product_interactions", "transaction_signals", "financial_profiles", "product_eligibility", "model_versions", "recommendations", "applications", "transactions", "goals", "consent_events", "consents", "preferences", "product_versions", "products", "customers", "audit_log"]) {
        db.exec(`DELETE FROM ${t}`);
      }
    });
    seed();
  }

  // ---- Live transactions and triggers (step 3) ----
  /**
   * Store a line that arrived live. With the bank's own transaction id, a repeated delivery is
   * recognised and ignored (returns null) — webhooks are retried and may arrive twice.
   */
  function addTransaction(customerId: string, t: Omit<RawTransaction, "id">, externalId?: string): RawTransaction | null {
    const row: RawTransaction = { ...t, id: externalId ? `LIVE_X_${externalId}` : id("LIVE") };
    if (externalId && db.prepare("SELECT 1 FROM transactions WHERE id = ?").get(row.id)) return null;
    db.prepare("INSERT INTO transactions (id, customer_id, date, narration, amount, direction, channel) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
      row.id, customerId, row.date, cipher.seal(row.narration, "transactions.narration"), row.amount, row.direction, row.channel,
    );
    return row;
  }

  function recordTrigger(
    customerId: string,
    transactionId: string,
    trigger: Trigger,
    decision: { outcome: TriggerEvent["outcome"]; reason: string },
    notification: Omit<AppNotification, "id" | "customer_id" | "event_id" | "created_at"> | null,
  ): { event: TriggerEvent; notification: AppNotification | null } {
    const t = now();
    const eventId = id("EVT");
    const n: AppNotification | null = notification && { ...notification, id: id("NTF"), customer_id: customerId, event_id: eventId, created_at: t };
    tx(() => {
      db.prepare(
        "INSERT INTO trigger_events (id, customer_id, transaction_id, type, amount, description, outcome, reason, notification_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      ).run(eventId, customerId, transactionId, trigger.type, trigger.amount, cipher.seal(trigger.description, "trigger_events.description"), decision.outcome, decision.reason, n?.id ?? null, t);
      if (n)
        db.prepare(
          "INSERT INTO notifications (id, customer_id, event_id, kind, title, body, product_id, product_name, recommendation_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        ).run(n.id, customerId, eventId, n.kind, n.title, cipher.seal(n.body, "notifications.body"), n.product_id, n.product_name, n.recommendation_id ?? null, t);
    });
    // No amounts or narrations in the audit log: it records what MoneyMap decided, not the customer's finances.
    audit("system", `trigger.${decision.outcome}`, `${customerId}: ${trigger.type}${n ? ` → ${n.product_name} (${n.kind})` : ""}`);
    return { event: listTriggerEvents(customerId).find((e) => e.id === eventId)!, notification: n };
  }

  // ---- Anonymous visit counts: a daily tally per public page, nothing about the visitor ----
  function countPageView(path: string) {
    db.prepare("INSERT INTO page_views (day, path, count) VALUES (?, ?, 1) ON CONFLICT(day, path) DO UPDATE SET count = count + 1").run(now().slice(0, 10), path);
  }

  function pageViews(days = 30) {
    const since = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
    return db.prepare("SELECT day, path, count FROM page_views WHERE day >= ? ORDER BY day DESC, path").all(since) as { day: string; path: string; count: number }[];
  }

  // ---- The customer's own answers about their money ----
  function getSelfReport(customerId: string): SelfReport | null {
    const row = db.prepare("SELECT json FROM self_reports WHERE customer_id = ?").get(customerId) as { json: string } | undefined;
    return row ? (JSON.parse(cipher.open(row.json, "self_reports.json")) as SelfReport) : null;
  }

  function setSelfReport(customerId: string, r: Omit<SelfReport, "updatedAt">): SelfReport {
    const saved: SelfReport = { ...r, updatedAt: now() };
    db.prepare(
      "INSERT INTO self_reports (customer_id, json, updated_at) VALUES (?, ?, ?) ON CONFLICT(customer_id) DO UPDATE SET json = excluded.json, updated_at = excluded.updated_at",
    ).run(customerId, cipher.seal(JSON.stringify(saved), "self_reports.json"), saved.updatedAt);
    // Which questions were answered, never the amounts.
    const answered = [r.accounts.length && "accounts", r.fixedIncome && "fixed income", r.variableIncome.length && "variable income", r.expenses.mode !== "unsure" && "expenses"].filter(Boolean);
    audit("customer", "self_report.updated", `${customerId}: ${answered.join(", ") || "nothing"}`);
    return saved;
  }

  // ---- Statement sync and message delivery (step 4) ----
  /** Merge lines fetched from core banking into the stored statement. Returns how many were new. */
  function mergeStatement(customerId: string, lines: RawTransaction[]): number {
    let added = 0;
    tx(() => {
      for (const t of lines) {
        added += Number(db
          .prepare("INSERT OR IGNORE INTO transactions (id, customer_id, date, narration, amount, direction, channel) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(`BANK_${t.id}`, customerId, t.date, cipher.seal(t.narration, "transactions.narration"), t.amount, t.direction, t.channel).changes);
      }
    });
    return added;
  }

  function recordSync(customerId: string, status: "ok" | "failed" | "demo", lines: number, error: string | null = null) {
    db.prepare(
      "INSERT INTO statement_syncs (customer_id, synced_at, status, lines, error) VALUES (?, ?, ?, ?, ?) ON CONFLICT(customer_id) DO UPDATE SET synced_at = excluded.synced_at, status = excluded.status, lines = excluded.lines, error = excluded.error",
    ).run(customerId, now(), status, lines, error);
  }

  function lastSync(customerId: string) {
    return (db.prepare("SELECT synced_at, status, lines, error FROM statement_syncs WHERE customer_id = ?").get(customerId) as
      | { synced_at: string; status: string; lines: number; error: string | null }
      | undefined) ?? null;
  }

  function recordDelivery(notificationId: string, customerId: string, r: { status: "delivered" | "failed"; channel?: string; reference?: string; error?: string }) {
    db.prepare(
      `INSERT INTO deliveries (notification_id, customer_id, status, attempts, channel, reference, last_error, updated_at) VALUES (?, ?, ?, 1, ?, ?, ?, ?)
       ON CONFLICT(notification_id) DO UPDATE SET status = excluded.status, attempts = deliveries.attempts + 1, channel = COALESCE(excluded.channel, deliveries.channel),
         reference = COALESCE(excluded.reference, deliveries.reference), last_error = excluded.last_error, updated_at = excluded.updated_at`,
    ).run(notificationId, customerId, r.status, r.channel ?? null, r.reference ?? null, r.error ?? null, now());
    audit("system", `notification.${r.status}`, `${customerId}: ${notificationId}${r.reference ? ` → ${r.reference}` : ""}${r.error ? ` (${r.error})` : ""}`);
  }

  function listDeliveries(filter: { status?: "failed"; maxAttempts?: number } = {}) {
    return db
      .prepare(
        `SELECT d.notification_id, d.customer_id, d.status, d.attempts, d.channel, d.reference, d.last_error, d.updated_at, n.title
         FROM deliveries d LEFT JOIN notifications n ON n.id = d.notification_id
         ${filter.status ? "WHERE d.status = ? AND d.attempts < ?" : ""} ORDER BY d.updated_at DESC LIMIT 50`,
      )
      .all(...(filter.status ? [filter.status, filter.maxAttempts ?? 99] : [])) as {
      notification_id: string;
      customer_id: string;
      status: string;
      attempts: number;
      channel: string | null;
      reference: string | null;
      last_error: string | null;
      updated_at: string;
      title: string | null;
    }[];
  }

  function getNotification(notificationId: string) {
    return listNotificationsWhere("id = ?", notificationId)[0] ?? null;
  }

  function pendingHandoffs() {
    return db.prepare("SELECT id, customer_id, product_id FROM applications WHERE handoff_status = 'pending' ORDER BY at").all() as {
      id: string;
      customer_id: string;
      product_id: string;
    }[];
  }

  function setApplicationHandoff(applicationId: string, r: { status: "handed_off" | "pending"; reference?: string; error?: string }) {
    db.prepare("UPDATE applications SET handoff_status = ?, reference = COALESCE(?, reference), handoff_error = ? WHERE id = ?").run(
      r.status, r.reference ?? null, r.error ?? null, applicationId,
    );
    audit("system", `application.${r.status}`, `${applicationId}${r.reference ? ` → ${r.reference}` : ""}${r.error ? ` (${r.error})` : ""}`);
  }

  function listTriggerEvents(customerId?: string): TriggerEvent[] {
    const rows = (customerId
      ? db.prepare("SELECT * FROM trigger_events WHERE customer_id = ? ORDER BY created_at DESC, rowid DESC").all(customerId)
      : db.prepare("SELECT * FROM trigger_events ORDER BY created_at DESC, rowid DESC LIMIT 200").all()) as Record<string, string | number | null>[];
    return rows.map((r) => ({
      id: String(r.id),
      customer_id: String(r.customer_id),
      transaction_id: String(r.transaction_id),
      type: r.type as TriggerEvent["type"],
      amount: Number(r.amount),
      description: cipher.open(String(r.description), "trigger_events.description"),
      outcome: r.outcome as TriggerEvent["outcome"],
      reason: String(r.reason),
      ...(r.notification_id ? { notification_id: String(r.notification_id) } : {}),
      created_at: String(r.created_at),
    }));
  }

  function listNotifications(customerId: string): AppNotification[] {
    return listNotificationsWhere("customer_id = ?", customerId);
  }

  function listNotificationsWhere(where: string, arg: string): AppNotification[] {
    return (db.prepare(`SELECT * FROM notifications WHERE ${where} ORDER BY created_at DESC, rowid DESC`).all(arg) as Record<string, string | null>[]).map(
      (r) => ({
        id: String(r.id),
        customer_id: String(r.customer_id),
        event_id: String(r.event_id),
        kind: r.kind as AppNotification["kind"],
        title: String(r.title),
        body: cipher.open(String(r.body), "notifications.body"),
        product_id: String(r.product_id),
        product_name: String(r.product_name),
        ...(r.recommendation_id ? { recommendation_id: String(r.recommendation_id) } : {}),
        created_at: String(r.created_at),
        ...(r.read_at ? { read_at: String(r.read_at) } : {}),
      }),
    );
  }

  function markNotificationRead(customerId: string, notificationId: string): boolean {
    return db.prepare("UPDATE notifications SET read_at = COALESCE(read_at, ?) WHERE id = ? AND customer_id = ?").run(now(), notificationId, customerId).changes > 0;
  }

  // ---- Customers ----
  function getTransactions(customerId: string): RawTransaction[] {
    return (db.prepare("SELECT id, date, narration, amount, direction, channel FROM transactions WHERE customer_id = ? ORDER BY date, id").all(customerId) as unknown as RawTransaction[]).map(
      (t) => ({ ...t, narration: cipher.open(t.narration, "transactions.narration") }),
    );
  }

  // Only current demo customers are served, even if an older database still holds retired ones.
  const DEMO_IDS = new Set(PERSONA_BASES.map((b) => b.id));

  function getPersonaBase(customerId: string): PersonaBase | null {
    if (!DEMO_IDS.has(customerId)) return null;
    const row = db.prepare("SELECT profile_json FROM customers WHERE id = ?").get(customerId) as { profile_json: string } | undefined;
    return row ? (JSON.parse(row.profile_json) as PersonaBase) : null;
  }

  /** The customer's profile, read from their stored transactions. */
  function getCustomer(customerId: string): CustomerProfile | null {
    const base = getPersonaBase(customerId);
    return base ? deriveProfile(base, getTransactions(customerId), { today: DEMO_TODAY, openingBalance: base.openingBalance }) : null;
  }

  function listCustomers(): PersonaBase[] {
    return (db.prepare("SELECT profile_json FROM customers ORDER BY id").all() as { profile_json: string }[]).map((r) => JSON.parse(r.profile_json) as PersonaBase).filter((c) => DEMO_IDS.has(c.id));
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
    return (db.prepare("SELECT * FROM goals WHERE customer_id = ? ORDER BY created_at DESC").all(customerId) as unknown as GoalRow[]).map((r) => toGoal(r, cipher.open));
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
      ).run(goalId, customerId, g.type, cipher.seal(g.label, "goals.label"), g.amount, g.timelineMonths, g.saved ?? 0, g.expenseKind ?? null, makeActive ? 1 : 0, now());
    });
    audit("customer", "goal.created", `${customerId}: ${g.type}`);
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
      ).run(next.type, cipher.seal(next.label, "goals.label"), next.amount, next.timelineMonths, next.saved, next.expenseKind ?? null, next.active ? 1 : 0, goalId, customerId);
    });
    audit("customer", "goal.updated", `${customerId}: ${next.type}`);
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
    return (rows as unknown as RecommendationRow[]).map((r) => toRecommendation(r, cipher.open));
  }

  function getRecommendationRow(recId: string) {
    return db.prepare("SELECT * FROM recommendations WHERE id = ?").get(recId) as RecommendationRow | undefined;
  }

  function getRecommendation(recId: string) {
    const row = getRecommendationRow(recId);
    if (!row) return null;
    return {
      record: toRecommendation(row, cipher.open),
      explanation: JSON.parse(cipher.open(row.explanation_json, "recommendations.explanation_json")),
      trace: JSON.parse(cipher.open(row.trace_json, "recommendations.trace_json")),
      factors: JSON.parse(row.factors_json),
    };
  }

  function insertRecommendation(
    rec: Omit<RecommendationRecord, "id" | "created_at" | "status">,
    snapshot: { explanation: { influences: { key: string; label: string; detail: string }[] }; trace: unknown; factors: unknown },
  ): RecommendationRecord {
    const recId = id("REC");
    tx(() => {
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
      cipher.seal(rec.timing_reason, "recommendations.timing_reason"),
      rec.eligibility_status,
      rec.model_version,
      cipher.seal(JSON.stringify(snapshot.explanation), "recommendations.explanation_json"),
      cipher.seal(JSON.stringify(snapshot.trace), "recommendations.trace_json"),
      JSON.stringify(snapshot.factors),
      now(),
    );
    snapshot.explanation.influences.forEach((r, i) =>
      db.prepare("INSERT INTO recommendation_reasons (recommendation_id, position, reason_key, label, detail) VALUES (?, ?, ?, ?, ?)").run(recId, i, r.key, r.label, cipher.seal(r.detail, "recommendation_reasons.detail")),
    );
    });
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
    tx(() => {
      db.prepare("UPDATE recommendations SET feedback = ?, feedback_at = ?, status = ?, snoozed_until = ? WHERE id = ?").run(feedback, t, status, snoozed, recId);
      db.prepare("INSERT INTO recommendation_feedback (id, recommendation_id, customer_id, feedback, at) VALUES (?, ?, ?, ?, ?)").run(id("FB"), recId, row.customer_id, feedback, t);
    });
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
      recordInteraction(customerId, product.product_id, "requested");
    });
    audit("customer", "product.request_submitted", `${customerId}: ${product.name}`);
    return app;
  }

  function listApplications(customerId: string): Application[] {
    return (db.prepare("SELECT id, product_id, product_name, status, at, reference, handoff_status FROM applications WHERE customer_id = ? ORDER BY at DESC").all(customerId) as {
      id: string;
      product_id: string;
      product_name: string;
      status: "submitted";
      at: string;
      reference: string | null;
      handoff_status: Application["handoff"] | null;
    }[]).map((r) => ({
      id: r.id,
      productId: r.product_id,
      productName: r.product_name,
      status: r.status,
      at: r.at,
      ...(r.reference ? { reference: r.reference } : {}),
      ...(r.handoff_status ? { handoff: r.handoff_status } : {}),
    }));
  }

  // ---- Product interactions ----
  type Interaction = "viewed" | "explored" | "eligibility_checked" | "requested";
  function recordInteraction(customerId: string, productId: string, interaction: Interaction, recommendationId: string | null = null) {
    db.prepare("INSERT INTO product_interactions (id, customer_id, product_id, recommendation_id, interaction, at) VALUES (?, ?, ?, ?, ?, ?)").run(
      id("INT"),
      customerId,
      productId,
      recommendationId,
      interaction,
      now(),
    );
  }

  function interactionCounts() {
    return db.prepare("SELECT product_id, interaction, COUNT(*) AS n FROM product_interactions GROUP BY product_id, interaction").all() as {
      product_id: string;
      interaction: Interaction;
      n: number;
    }[];
  }

  function feedbackHistory(recId: string) {
    return db.prepare("SELECT feedback, at FROM recommendation_feedback WHERE recommendation_id = ? ORDER BY at").all(recId) as { feedback: FeedbackType; at: string }[];
  }

  function recommendationReasons(recId: string) {
    return (db.prepare("SELECT reason_key, label, detail FROM recommendation_reasons WHERE recommendation_id = ? ORDER BY position").all(recId) as {
      reason_key: string;
      label: string;
      detail: string;
    }[]).map((r) => ({ ...r, detail: cipher.open(r.detail, "recommendation_reasons.detail") }));
  }

  // ---- Financial profile & signals (only what the customer permitted) ----
  function saveFinancialSnapshot(
    customerId: string,
    ctx: {
      income: { average: number; stability: string } | null;
      spending: { average: number; recurring: number } | null;
      surplus: { average: number } | null;
      coverage: number;
      permissions: Permissions;
      signals: { signal: string; strength: number; evidence: string; source: string }[];
    },
  ) {
    const t = now();
    tx(() => {
      db.prepare(
        `INSERT INTO financial_profiles (customer_id, income_avg, income_stability, spending_avg, recurring_commitments, surplus_avg, coverage, permissions_json, computed_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(customer_id) DO UPDATE SET income_avg = excluded.income_avg, income_stability = excluded.income_stability,
           spending_avg = excluded.spending_avg, recurring_commitments = excluded.recurring_commitments, surplus_avg = excluded.surplus_avg,
           coverage = excluded.coverage, permissions_json = excluded.permissions_json, computed_at = excluded.computed_at`,
      ).run(
        customerId,
        ctx.income ? Math.round(ctx.income.average) : null,
        ctx.income?.stability ?? null,
        ctx.spending ? Math.round(ctx.spending.average) : null,
        ctx.spending ? Math.round(ctx.spending.recurring) : null,
        ctx.surplus ? Math.round(ctx.surplus.average) : null,
        ctx.coverage,
        JSON.stringify(ctx.permissions),
        t,
      );
      // Signals are replaced wholesale, so a withdrawn permission removes its signals immediately.
      db.prepare("DELETE FROM transaction_signals WHERE customer_id = ?").run(customerId);
      for (const s of ctx.signals) {
        db.prepare("INSERT INTO transaction_signals (customer_id, signal, strength, evidence, source_permission, computed_at) VALUES (?, ?, ?, ?, ?, ?)").run(
          customerId,
          s.signal,
          s.strength,
          cipher.seal(s.evidence, "transaction_signals.evidence"),
          s.source,
          t,
        );
      }
    });
  }

  function getFinancialProfile(customerId: string) {
    return (db.prepare("SELECT * FROM financial_profiles WHERE customer_id = ?").get(customerId) as Record<string, unknown> | undefined) ?? null;
  }

  function getSignals(customerId: string) {
    return (db.prepare("SELECT signal, strength, evidence, source_permission, computed_at FROM transaction_signals WHERE customer_id = ? ORDER BY signal").all(customerId) as {
      signal: string;
      strength: number;
      evidence: string;
      source_permission: string;
      computed_at: string;
    }[]).map((r) => ({ ...r, evidence: cipher.open(r.evidence, "transaction_signals.evidence") }));
  }

  function productEligibility(productId: string) {
    return (db.prepare("SELECT condition, value, basis, source FROM product_eligibility WHERE product_id = ? ORDER BY basis DESC, condition").all(productId) as {
      condition: string;
      value: string;
      basis: string;
      source: string | null;
    }[]).map((r) => ({ ...r, value: JSON.parse(r.value) }));
  }

  // ---- Model versions ----
  function registerModelVersion(version: string, weights: unknown, thresholds: unknown, description: string) {
    db.prepare("INSERT OR IGNORE INTO model_versions (version, weights_json, thresholds_json, description, first_used_at) VALUES (?, ?, ?, ?, ?)").run(
      version,
      JSON.stringify(weights),
      JSON.stringify(thresholds),
      description,
      now(),
    );
  }

  function listModelVersions() {
    return (db.prepare("SELECT * FROM model_versions ORDER BY first_used_at").all() as {
      version: string;
      weights_json: string;
      thresholds_json: string;
      description: string;
      first_used_at: string;
    }[]).map((r) => ({ version: r.version, weights: JSON.parse(r.weights_json), thresholds: JSON.parse(r.thresholds_json), description: r.description, first_used_at: r.first_used_at }));
  }

  seed();

  return {
    getTransactions,
    recordInteraction,
    interactionCounts,
    feedbackHistory,
    recommendationReasons,
    saveFinancialSnapshot,
    getFinancialProfile,
    getSignals,
    productEligibility,
    registerModelVersion,
    listModelVersions,
    raw: db,
    close: () => db.close(),
    audit,
    auditLog,
    verifyAudit,
    resetCustomer,
    resetAll,
    getCustomer,
    listCustomers,
    eraseCustomer,
    getSelfReport,
    countPageView,
    pageViews,
    setSelfReport,
    addTransaction,
    mergeStatement,
    recordSync,
    lastSync,
    recordDelivery,
    listDeliveries,
    getNotification,
    setApplicationHandoff,
    pendingHandoffs,
    recordTrigger,
    listTriggerEvents,
    listNotifications,
    markNotificationRead,
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
