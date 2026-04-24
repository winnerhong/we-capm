-- =====================================================
-- Org Documents (Phase 1 MVP)
-- 기관(partner_orgs) 서류 관리: 직접 제출 OR 지사 대행
-- =====================================================

CREATE TABLE IF NOT EXISTS org_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES partners(id) ON DELETE SET NULL,
  doc_type text NOT NULL CHECK (doc_type IN (
    'BUSINESS_REG','BANKBOOK','TAX_CONTRACT',
    'INSURANCE','FACILITY_CONSENT','PRIVACY_CONSENT'
  )),
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  uploaded_by text NOT NULL DEFAULT 'ORG'
    CHECK (uploaded_by IN ('ORG','PARTNER')),
  uploaded_by_id uuid,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  reject_reason text,
  expires_at timestamptz,
  version int NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_org_documents_org ON org_documents(org_id);
CREATE INDEX IF NOT EXISTS idx_org_documents_partner ON org_documents(partner_id);
CREATE INDEX IF NOT EXISTS idx_org_documents_status ON org_documents(status);
CREATE INDEX IF NOT EXISTS idx_org_documents_type ON org_documents(doc_type);

ALTER TABLE org_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_documents_all" ON org_documents;
CREATE POLICY "org_documents_all" ON org_documents FOR ALL USING (true) WITH CHECK (true);
