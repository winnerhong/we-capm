-- =====================================================
-- Partner Documents (Phase 1 MVP)
-- 파트너 서류 제출/검토: 버전 관리 + 만료 추적
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN (
    'BUSINESS_REG','BANKBOOK','CEO_ID','CONTRACT',
    'INSURANCE','REFUND_POLICY',
    'FOREST_CERT','CPR_CERT','SAFETY_INSPECT'
  )),
  file_url text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','EXPIRED')),
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  reject_reason text,
  expires_at timestamptz,
  version int NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_documents_partner ON partner_documents(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_documents_status ON partner_documents(status);
CREATE INDEX IF NOT EXISTS idx_partner_documents_expires ON partner_documents(expires_at);
CREATE INDEX IF NOT EXISTS idx_partner_documents_type ON partner_documents(doc_type);

ALTER TABLE partner_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_documents_all" ON partner_documents;
CREATE POLICY "partner_documents_all" ON partner_documents
  FOR ALL USING (true) WITH CHECK (true);

-- Storage 버킷 (민감 문서용, 비공개)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('partner-documents', 'partner-documents', false, 5242880,
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']::text[])
ON CONFLICT (id) DO UPDATE SET
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS "partner-documents: upload" ON storage.objects;
CREATE POLICY "partner-documents: upload" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'partner-documents');

DROP POLICY IF EXISTS "partner-documents: read" ON storage.objects;
CREATE POLICY "partner-documents: read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'partner-documents');

DROP POLICY IF EXISTS "partner-documents: delete" ON storage.objects;
CREATE POLICY "partner-documents: delete" ON storage.objects
  FOR DELETE TO anon, authenticated
  USING (bucket_id = 'partner-documents');
