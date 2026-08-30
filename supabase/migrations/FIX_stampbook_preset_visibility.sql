-- ============================================================================
-- 고치기 — partner_stampbook_presets.visibility 누락
--
-- 실행 방법: Supabase → SQL Editor → 이 파일 전체 붙여넣고 Run.
--
-- ## 무슨 일이 있었나
--   마이그레이션 20260530000000_stampbook_preset_visibility.sql 이 **반쪽만** 적용됐다.
--     CREATE TABLE partner_stampbook_preset_org_grants  → 적용됨
--     ALTER TABLE partner_stampbook_presets ADD visibility → 안 됨
--
--   그런데 코드는 이 컬럼을 실제로 읽고 쓴다:
--     저장 src/app/partner/stampbook-presets/actions.ts (368, 452)
--     조회 src/app/partner/stampbook-presets/page.tsx   (31, 151)
--   → 숲지기 스탬프북 프리셋 저장·조회가 지금 동작하지 않는다(읽기 42703 / 쓰기 PGRST204).
--     다행히 partner_stampbook_presets 가 0행이라 아직 아무도 못 썼다.
--
-- ## 원본 파일을 다시 돌리는 것과 뭐가 다른가
--   원본은 맨 끝 `NOTIFY pgrst, 'reload schema';` 가 **주석 처리**돼 있다.
--   ALTER 를 돌려도 PostgREST 가 스키마 캐시를 갱신하지 않으면 앱에서는 계속
--   "컬럼 없음" 으로 보인다. 여기서는 NOTIFY 를 실제로 실행한다.
--
-- 재실행 안전(idempotent) — 이미 있으면 아무 일도 하지 않는다.
-- ============================================================================

ALTER TABLE partner_stampbook_presets
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'ALL_ORGS', 'SELECTED_ORGS'));

-- 기관용 조회(공개된 것 중 공유 범위로 거르기)가 타는 인덱스.
CREATE INDEX IF NOT EXISTS idx_stampbook_presets_visibility
  ON partner_stampbook_presets (partner_id, is_published, visibility)
  WHERE is_published = true AND visibility <> 'PRIVATE';

-- ⚠ 이게 핵심 — 이걸 빼면 컬럼이 생겨도 앱에서는 계속 안 보인다.
NOTIFY pgrst, 'reload schema';

-- 검증: 아래가 1행 나오면 정상.
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'partner_stampbook_presets'
  AND column_name = 'visibility';
