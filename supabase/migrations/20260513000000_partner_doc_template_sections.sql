-- =====================================================
-- Partner Doc Templates — Online Section Editor
-- 자립형 마이그레이션: 테이블이 없으면 생성, 있으면 컬럼만 추가.
--   format = 'FILE'     : file_url 기반 (기존 업로드)
--   format = 'SECTIONS' : sections JSON 기반 (온라인 편집)
-- UNIQUE (partner_id, doc_type) — 한 지사당 doc_type 1개.
-- =====================================================

-- 1) 테이블 자립 생성 (없을 때만)
CREATE TABLE IF NOT EXISTS partner_doc_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN (
    'TAX_CONTRACT','FACILITY_CONSENT','PRIVACY_CONSENT'
  )),
  file_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  version int NOT NULL DEFAULT 1,
  notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, doc_type)
);
CREATE INDEX IF NOT EXISTS idx_partner_doc_templates_partner
  ON partner_doc_templates(partner_id);

-- 2) RLS + 정책 (기존 마이그레이션과 동일 — 재실행 안전)
ALTER TABLE partner_doc_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_doc_templates_all" ON partner_doc_templates;
CREATE POLICY "partner_doc_templates_all" ON partner_doc_templates
  FOR ALL USING (true) WITH CHECK (true);

-- 3) 신규 컬럼 추가 (이미 있으면 스킵)
ALTER TABLE partner_doc_templates
  ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'FILE'
    CHECK (format IN ('FILE', 'SECTIONS'));

ALTER TABLE partner_doc_templates
  ADD COLUMN IF NOT EXISTS sections jsonb;

ALTER TABLE partner_doc_templates
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- 4) 기존 file_url NOT NULL 제약이 남아 있다면 완화
--    (SECTIONS 모드는 file_url 없이도 저장되어야 함)
ALTER TABLE partner_doc_templates
  ALTER COLUMN file_url DROP NOT NULL;

-- 5) 조회 최적화
CREATE INDEX IF NOT EXISTS idx_partner_doc_templates_format
  ON partner_doc_templates(partner_id, doc_type, format);
