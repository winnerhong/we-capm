-- =====================================================
-- Program Distribution (Phase 1)
-- 선택 배포(visibility) + 기획 필드 확장 + assignments junction
-- =====================================================

-- 1) partner_programs 확장
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'DRAFT'
  CHECK (visibility IN ('DRAFT','ALL','SELECTED','ARCHIVED'));

-- 기획 필드 (Phase 1)
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS long_description text;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS schedule_items jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS required_items text[] NOT NULL DEFAULT '{}';
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS safety_notes text;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS target_audience text;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS faq jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE partner_programs ADD COLUMN IF NOT EXISTS linked_trail_id uuid REFERENCES partner_trails(id) ON DELETE SET NULL;

-- 기존 is_published 기반 데이터 마이그레이션 (idempotent — 이미 migrate된 행은 건너뜀)
UPDATE partner_programs
  SET visibility = 'ALL'
  WHERE is_published = true AND visibility = 'DRAFT';

CREATE INDEX IF NOT EXISTS idx_partner_programs_visibility ON partner_programs(visibility);
CREATE INDEX IF NOT EXISTS idx_partner_programs_linked_trail ON partner_programs(linked_trail_id);

-- 2) partner_program_assignments (선택 배포 junction)
CREATE TABLE IF NOT EXISTS partner_program_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES partner_programs(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  assigned_by uuid, -- partner.id (지사)
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(program_id, org_id)
);
CREATE INDEX IF NOT EXISTS idx_assignments_program ON partner_program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_assignments_org ON partner_program_assignments(org_id);

ALTER TABLE partner_program_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_program_assignments_all" ON partner_program_assignments;
CREATE POLICY "partner_program_assignments_all" ON partner_program_assignments FOR ALL USING (true) WITH CHECK (true);
