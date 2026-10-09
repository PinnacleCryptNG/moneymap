-- Row-level security for MoneyMap on PostgreSQL.
--
-- The API connects as moneymap_app and, at the start of every request, runs
--   SELECT set_config('app.customer_id', '<signed-in customer id>', true);   -- customer requests
--   SELECT set_config('app.role', 'admin', true);                             -- bank-staff requests
-- in the request's transaction. The database itself then refuses to show or change any other
-- customer's rows — even if application code forgot a WHERE clause.

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'moneymap_app') THEN CREATE ROLE moneymap_app NOLOGIN; END IF;
END $$;

CREATE OR REPLACE FUNCTION moneymap_customer() RETURNS text LANGUAGE sql STABLE AS
  $$ SELECT nullif(current_setting('app.customer_id', true), '') $$;
CREATE OR REPLACE FUNCTION moneymap_is_admin() RETURNS boolean LANGUAGE sql STABLE AS
  $$ SELECT coalesce(current_setting('app.role', true), '') = 'admin' $$;

-- Customer-owned tables: a customer sees and changes only their own rows; bank staff can read them.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'transactions', 'trigger_events', 'self_reports', 'deliveries', 'statement_syncs', 'notifications',
    'consents', 'consent_events', 'goals', 'preferences', 'recommendations', 'applications',
    'financial_profiles', 'transaction_signals', 'recommendation_feedback', 'product_interactions'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS own_rows ON %I', t);
    EXECUTE format('CREATE POLICY own_rows ON %I FOR ALL TO moneymap_app USING (customer_id = moneymap_customer()) WITH CHECK (customer_id = moneymap_customer())', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_read ON %I', t);
    EXECUTE format('CREATE POLICY staff_read ON %I FOR SELECT TO moneymap_app USING (moneymap_is_admin())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO moneymap_app', t);
  END LOOP;
END $$;

-- The customer record itself.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS own_row ON customers;
CREATE POLICY own_row ON customers FOR SELECT TO moneymap_app USING (id = moneymap_customer() OR moneymap_is_admin());
GRANT SELECT ON customers TO moneymap_app;

-- Reasons belong to a recommendation, so they follow its owner.
ALTER TABLE recommendation_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_reasons FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS via_recommendation ON recommendation_reasons;
CREATE POLICY via_recommendation ON recommendation_reasons FOR ALL TO moneymap_app
  USING (moneymap_is_admin() OR EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND r.customer_id = moneymap_customer()))
  WITH CHECK (EXISTS (SELECT 1 FROM recommendations r WHERE r.id = recommendation_id AND r.customer_id = moneymap_customer()));
GRANT SELECT, INSERT, UPDATE, DELETE ON recommendation_reasons TO moneymap_app;

-- Catalogue: everyone reads; only bank staff change it.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'product_versions', 'product_eligibility', 'model_versions'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS read_all ON %I', t);
    EXECUTE format('CREATE POLICY read_all ON %I FOR SELECT TO moneymap_app USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS staff_write ON %I', t);
    EXECUTE format('CREATE POLICY staff_write ON %I FOR ALL TO moneymap_app USING (moneymap_is_admin()) WITH CHECK (moneymap_is_admin())', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO moneymap_app', t);
  END LOOP;
END $$;

-- Audit log: anyone may append; only bank staff read; nobody updates or deletes (append-only).
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS append ON audit_log;
CREATE POLICY append ON audit_log FOR INSERT TO moneymap_app WITH CHECK (true);
DROP POLICY IF EXISTS staff_read ON audit_log;
CREATE POLICY staff_read ON audit_log FOR SELECT TO moneymap_app USING (moneymap_is_admin());
GRANT SELECT, INSERT ON audit_log TO moneymap_app;
GRANT USAGE ON SEQUENCE audit_log_seq_seq TO moneymap_app;

-- Anonymous visit counts hold nothing personal.
GRANT SELECT, INSERT, UPDATE ON page_views TO moneymap_app;
