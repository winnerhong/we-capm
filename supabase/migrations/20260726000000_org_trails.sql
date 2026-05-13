-- ============================================================================
-- Migration: 20260726000000_org_trails.sql
-- Purpose : 기관 자체 코스 (간단 버전 — 이미지·제목·설명).
--           지사가 만든 partner_trails 와 분리. QR/슬롯/공유 링크는 미지원
--           (필요하면 후속 마이그레이션에서 확장).
--           "My 코스관리" 페이지에서 지사 코스 + 기관 자체 코스 함께 노출.
-- ============================================================================

CREATE TABLE IF NOT EXISTS org_trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  cover_image_url text NULL,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE org_trails IS '기관이 직접 올린 자체 코스 — 간단 버전 (이미지·제목·설명).';
COMMENT ON COLUMN org_trails.cover_image_url IS '커버 이미지 — Supabase Storage public URL.';
COMMENT ON COLUMN org_trails.display_order IS '코스 카드 정렬 순서 (오름차순).';

CREATE INDEX IF NOT EXISTS idx_org_trails_org
  ON org_trails(org_id, display_order);

ALTER TABLE org_trails ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_trails_all" ON org_trails;
CREATE POLICY "org_trails_all" ON org_trails
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at trigger — 기존 set_updated_at() helper 재사용
DROP TRIGGER IF EXISTS trg_org_trails_updated_at ON org_trails;
CREATE TRIGGER trg_org_trails_updated_at
  BEFORE UPDATE ON org_trails
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================================
-- End of migration 20260726000000_org_trails.sql
-- ============================================================================
