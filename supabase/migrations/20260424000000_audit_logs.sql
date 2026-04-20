-- Access audit log for PIPA compliance
CREATE TABLE IF NOT EXISTS access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL CHECK (user_type IN ('ADMIN','MANAGER','PARTNER','PARTICIPANT','PUBLIC')),
  user_id text,
  user_identifier text,
  action text NOT NULL,
  resource text,
  ip_address text,
  user_agent text,
  status_code int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at DESC);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "access_logs_all" ON access_logs;
CREATE POLICY "access_logs_all" ON access_logs FOR ALL USING (true) WITH CHECK (true);

-- Retention: PIPA requires 6+ months of access logs
-- Recommended: delete logs older than 1 year via scheduled job
