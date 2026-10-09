-- MoneyMap schema for PostgreSQL (production). Mirrors server/db.ts (SQLite) table for table;
-- a test (server/__tests__/rls.test.ts) fails if the two drift apart. Apply this, then rls.sql.
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
  amount BIGINT NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('credit', 'debit')),
  channel TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_customer ON transactions(customer_id, date);
CREATE TABLE IF NOT EXISTS trigger_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  transaction_id TEXT NOT NULL,
  type TEXT NOT NULL,
  amount BIGINT NOT NULL,
  description TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK (outcome IN ('notified', 'held_back')),
  reason TEXT NOT NULL,
  notification_id TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS page_views (
  day TEXT NOT NULL,
  path TEXT NOT NULL,
  count BIGINT NOT NULL,
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
  attempts BIGINT NOT NULL DEFAULT 0,
  channel TEXT,
  reference TEXT,
  last_error TEXT,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS statement_syncs (
  customer_id TEXT PRIMARY KEY,
  synced_at TEXT NOT NULL,
  status TEXT NOT NULL,
  lines BIGINT NOT NULL,
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
  granted BIGINT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (customer_id, permission)
);
CREATE TABLE IF NOT EXISTS consent_events (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  permission TEXT NOT NULL,
  granted BIGINT NOT NULL,
  at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS goals (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  type TEXT NOT NULL,
  label TEXT NOT NULL,
  amount BIGINT NOT NULL,
  timeline_months BIGINT NOT NULL,
  saved BIGINT NOT NULL DEFAULT 0,
  expense_kind TEXT,
  active BIGINT NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS preferences (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id),
  json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
  product_id TEXT PRIMARY KEY,
  version BIGINT NOT NULL,
  status TEXT NOT NULL,
  data_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS product_versions (
  product_id TEXT NOT NULL,
  version BIGINT NOT NULL,
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
  match_score BIGINT NOT NULL,
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
  at TEXT NOT NULL,
  reference TEXT,
  handoff_status TEXT,
  handoff_error TEXT
);
CREATE TABLE IF NOT EXISTS financial_profiles (
  customer_id TEXT PRIMARY KEY REFERENCES customers(id),
  income_avg BIGINT,
  income_stability TEXT,
  spending_avg BIGINT,
  recurring_commitments BIGINT,
  surplus_avg BIGINT,
  coverage DOUBLE PRECISION NOT NULL,
  permissions_json TEXT NOT NULL,
  computed_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transaction_signals (
  customer_id TEXT NOT NULL REFERENCES customers(id),
  signal TEXT NOT NULL,
  strength DOUBLE PRECISION NOT NULL,
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
  position BIGINT NOT NULL,
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
  seq BIGSERIAL PRIMARY KEY,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  detail TEXT NOT NULL,
  prev_hash TEXT NOT NULL,
  hash TEXT NOT NULL
);
