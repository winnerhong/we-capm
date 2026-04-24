-- =====================================================
-- Org Programs: 기관이 지사 템플릿을 활성화한 복사본
-- 기관(partner_orgs)이 partner_programs 카탈로그를 보고
-- "활성화" 버튼으로 스냅샷을 자기 계정에 복제 → 자유 편집
-- =====================================================

CREATE TABLE IF NOT EXISTS org_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  source_program_id uuid REFERENCES partner_programs(id) ON DELETE SET NULL,
  source_partner_id uuid, -- 원본 지사 id (읽기 편의용, FK 없이)

  title text NOT NULL,
  description text,
  category text NOT NULL,
  duration_hours numeric,
  capacity_min int DEFAULT 5,
  capacity_max int DEFAULT 30,
  price_per_person int NOT NULL DEFAULT 0,
  location_detail text,
  image_url text,
  tags text[],

  custom_theme jsonb NOT NULL DEFAULT '{}'::jsonb, -- 색상/아이콘/배너문구 커스터마이징
  custom_notes text, -- 내부 메모

  status text NOT NULL DEFAULT 'ACTIVATED' CHECK (status IN ('ACTIVATED','CUSTOMIZED','PUBLISHED','PAUSED','ARCHIVED')),
  is_published boolean NOT NULL DEFAULT false, -- 이용자에게 공개

  booking_count int NOT NULL DEFAULT 0,
  view_count int NOT NULL DEFAULT 0,

  activated_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_programs_org ON org_programs(org_id);
CREATE INDEX IF NOT EXISTS idx_org_programs_source ON org_programs(source_program_id);
CREATE INDEX IF NOT EXISTS idx_org_programs_status ON org_programs(status);

ALTER TABLE org_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_programs_all" ON org_programs;
CREATE POLICY "org_programs_all" ON org_programs FOR ALL USING (true) WITH CHECK (true);
