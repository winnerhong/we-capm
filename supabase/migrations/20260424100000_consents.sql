-- =====================================================
-- 📜 PIPA 동의 이력 저장 (user_consents)
-- 2026-04-24
-- =====================================================

CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL,
  user_identifier text NOT NULL,
  terms_agreed boolean NOT NULL DEFAULT false,
  terms_version text,
  privacy_agreed boolean NOT NULL DEFAULT false,
  privacy_version text,
  marketing_agreed boolean NOT NULL DEFAULT false,
  third_party_agreed boolean NOT NULL DEFAULT false,
  age_confirmed boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consents_user
  ON user_consents(user_identifier, created_at DESC);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_consents_all" ON user_consents;
CREATE POLICY "user_consents_all" ON user_consents FOR ALL USING (true) WITH CHECK (true);
