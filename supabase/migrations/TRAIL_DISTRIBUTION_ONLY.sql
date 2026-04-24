-- =====================================================
-- TRAIL DISTRIBUTION ONLY (자립 실행 버전)
-- Supabase SQL Editor에 그대로 복붙해서 실행
-- 선택 배포(visibility) + assignments junction
-- =====================================================

-- partner_trails에 visibility 컬럼 추가 (status와 공존, 점진 이관)
ALTER TABLE partner_trails ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'DRAFT'
  CHECK (visibility IN ('DRAFT','ALL','SELECTED','ARCHIVED'));

-- 기존 status 기반 데이터 마이그레이션 (idempotent — 이미 DRAFT 아닌 것만 업데이트)
UPDATE partner_trails SET visibility = 'ALL'
  WHERE status = 'PUBLISHED' AND visibility = 'DRAFT';
UPDATE partner_trails SET visibility = 'ARCHIVED'
  WHERE status = 'ARCHIVED' AND visibility = 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_partner_trails_visibility ON partner_trails(visibility);

-- 숲길 배포 junction
CREATE TABLE IF NOT EXISTS partner_trail_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES partner_trails(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trail_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_trail_assignments_trail ON partner_trail_assignments(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_assignments_org ON partner_trail_assignments(org_id);

ALTER TABLE partner_trail_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_trail_assignments_all" ON partner_trail_assignments;
CREATE POLICY "partner_trail_assignments_all" ON partner_trail_assignments
  FOR ALL USING (true) WITH CHECK (true);
