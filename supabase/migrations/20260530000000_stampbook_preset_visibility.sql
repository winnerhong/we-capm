-- ============================================================================
-- Migration: 20260530000000_stampbook_preset_visibility.sql
-- Purpose : 스탬프북 프리셋 기관 공유 범위 제어.
--           기존 is_published (=초안/완성) 은 유지하고,
--           신규 visibility (=공유 범위) 를 추가해 2축 모델 구성.
--
-- 기관 노출 조건:
--   is_published = true
--   AND (visibility = 'ALL_ORGS'
--        OR (visibility = 'SELECTED_ORGS' AND EXISTS grant))
--
-- PRIVATE 은 기관에 노출되지 않음 (지사 내부 사용).
-- ============================================================================

-- 1) visibility 컬럼
ALTER TABLE partner_stampbook_presets
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'ALL_ORGS', 'SELECTED_ORGS'));

-- 조회 최적화 — 기관용 퀴리에서 is_published + visibility 함께 필터
CREATE INDEX IF NOT EXISTS idx_stampbook_presets_visibility
  ON partner_stampbook_presets (partner_id, is_published, visibility)
  WHERE is_published = true AND visibility <> 'PRIVATE';

-- 2) 선택 공유 대상 기관 junction 테이블
CREATE TABLE IF NOT EXISTS partner_stampbook_preset_org_grants (
  preset_id  uuid NOT NULL REFERENCES partner_stampbook_presets(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (preset_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_preset_org_grants_org
  ON partner_stampbook_preset_org_grants (org_id);

-- RLS (Phase 0 permissive — Phase X 에서 조임 예정)
ALTER TABLE partner_stampbook_preset_org_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preset_org_grants_all" ON partner_stampbook_preset_org_grants;
CREATE POLICY "preset_org_grants_all" ON partner_stampbook_preset_org_grants
  FOR ALL USING (true) WITH CHECK (true);

-- 실행 후: NOTIFY pgrst, 'reload schema';
