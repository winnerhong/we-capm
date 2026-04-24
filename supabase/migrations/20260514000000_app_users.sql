-- =====================================================
-- App Users — 보호자(End-User) 레이어 도입 (Phase 0)
-- 자립형 마이그레이션: 테이블/인덱스/정책/뷰 모두 재실행 안전.
--   app_users               : 보호자 단위 이용자 (phone+password)
--   app_children            : 보호자 ↔ 아이 (1:N)
--   user_acorn_transactions : 도토리 적립/사용 원장
--   view_app_user_summary   : 보호자 요약 (children_count, last_acorn_at)
-- Phase 0 RLS: 전체 허용(permissive) — Phase 1에서 auth.uid() 기반으로 조임.
-- FK: partner_orgs(id)는 20260426000000 마이그레이션에서 이미 생성됨.
-- =====================================================

-- 1) app_users (보호자)
CREATE TABLE IF NOT EXISTS app_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  parent_name text NOT NULL,
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  acorn_balance int NOT NULL DEFAULT 0 CHECK (acorn_balance >= 0),
  status text NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','SUSPENDED','CLOSED')),
  notification_consent boolean NOT NULL DEFAULT true,
  first_login_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_users_org
  ON app_users(org_id);
CREATE INDEX IF NOT EXISTS idx_app_users_phone
  ON app_users(phone);

-- TODO: Phase 1 tighten with auth.uid()
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_users_all" ON app_users;
CREATE POLICY "app_users_all" ON app_users
  FOR ALL USING (true) WITH CHECK (true);


-- 2) app_children (보호자 ↔ 아이)
CREATE TABLE IF NOT EXISTS app_children (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  name text NOT NULL,
  birth_date date,
  gender text CHECK (gender IN ('M','F') OR gender IS NULL),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_app_children_user
  ON app_children(user_id);

-- TODO: Phase 1 tighten with auth.uid()
ALTER TABLE app_children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_children_all" ON app_children;
CREATE POLICY "app_children_all" ON app_children
  FOR ALL USING (true) WITH CHECK (true);


-- 3) user_acorn_transactions (도토리 원장)
CREATE TABLE IF NOT EXISTS user_acorn_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  amount int NOT NULL,
  reason text NOT NULL CHECK (reason IN (
    'STAMP_SLOT','STAMPBOOK_COMPLETE','CHALLENGE','ATTENDANCE',
    'SPEND_COUPON','SPEND_DECORATION','ADMIN_GRANT','ADMIN_DEDUCT','OTHER'
  )),
  source_id uuid,
  source_type text,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_acorn_tx_user_created
  ON user_acorn_transactions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_acorn_tx_reason
  ON user_acorn_transactions(reason);

-- TODO: Phase 1 tighten with auth.uid()
ALTER TABLE user_acorn_transactions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_acorn_transactions_all" ON user_acorn_transactions;
CREATE POLICY "user_acorn_transactions_all" ON user_acorn_transactions
  FOR ALL USING (true) WITH CHECK (true);


-- 4) view_app_user_summary
--    보호자별 요약: 아이 수 + 마지막 도토리 거래 시각
CREATE OR REPLACE VIEW view_app_user_summary AS
SELECT u.*,
       (SELECT count(*) FROM app_children c WHERE c.user_id = u.id) AS children_count,
       (SELECT max(created_at) FROM user_acorn_transactions t WHERE t.user_id = u.id) AS last_acorn_at
FROM app_users u;
