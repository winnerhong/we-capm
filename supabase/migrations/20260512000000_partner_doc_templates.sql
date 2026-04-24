-- =====================================================
-- Partner Doc Templates (Phase 2)
-- 지사 커스텀 서류 템플릿 업로드 (위탁계약서/시설동의서/개인정보동의서)
-- 한 지사당 doc_type 1개 (UPSERT 덮어쓰기)
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_doc_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN (
    'TAX_CONTRACT','FACILITY_CONSENT','PRIVACY_CONSENT'
  )),
  file_url text NOT NULL,       -- storage path
  file_name text,
  file_size bigint,
  mime_type text,
  version int NOT NULL DEFAULT 1,
  notes text,
  uploaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, doc_type)  -- 한 지사당 doc_type 1개 (덮어쓰기)
);
CREATE INDEX IF NOT EXISTS idx_partner_doc_templates_partner ON partner_doc_templates(partner_id);

ALTER TABLE partner_doc_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_doc_templates_all" ON partner_doc_templates;
CREATE POLICY "partner_doc_templates_all" ON partner_doc_templates
  FOR ALL USING (true) WITH CHECK (true);
