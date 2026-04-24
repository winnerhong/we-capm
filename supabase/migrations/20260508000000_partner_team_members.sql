-- =====================================================
-- Partner Team Members (Phase 1 MVP)
-- 파트너(지사)별 팀원 계정 — role/status 기반 RBAC
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text,
  phone text,
  username text NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('OWNER','MANAGER','STAFF','FINANCE','VIEWER')),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','DELETED')),
  invited_by uuid,
  invited_at timestamptz NOT NULL DEFAULT now(),
  activated_at timestamptz,
  last_login_at timestamptz,
  suspended_at timestamptz,
  memo text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, username)
);
CREATE INDEX IF NOT EXISTS idx_team_members_partner ON partner_team_members(partner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_status ON partner_team_members(status);
CREATE INDEX IF NOT EXISTS idx_team_members_username ON partner_team_members(username);

ALTER TABLE partner_team_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_team_members_all" ON partner_team_members;
CREATE POLICY "partner_team_members_all" ON partner_team_members
  FOR ALL USING (true) WITH CHECK (true);
