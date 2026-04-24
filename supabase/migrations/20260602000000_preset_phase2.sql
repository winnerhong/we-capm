-- =====================================================================
-- Stampbook Preset Phase 2
-- 1) partner_stampbook_presets.category (text[]) + GIN index
-- 2) Storage bucket `preset-covers` (public) + permissive RLS
-- =====================================================================
-- 주의: 현재 Phase 0 permissive RLS 정책에 맞춘 완화된 Storage 정책.
--       Phase 1 전환 시 세분화 필요.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. partner_stampbook_presets.category (text[])
-- ---------------------------------------------------------------------
ALTER TABLE partner_stampbook_presets
  ADD COLUMN IF NOT EXISTS category text[] DEFAULT ARRAY[]::text[];

-- GIN 인덱스: category && ARRAY[...] / category @> ARRAY[...] 형태 필터 대비
CREATE INDEX IF NOT EXISTS idx_preset_categories
  ON partner_stampbook_presets
  USING GIN (category);

-- ---------------------------------------------------------------------
-- 2. Storage bucket: preset-covers
-- ---------------------------------------------------------------------
-- 버킷 생성 (public=true → 공개 읽기 가능)
INSERT INTO storage.buckets (id, name, public)
VALUES ('preset-covers', 'preset-covers', true)
ON CONFLICT (id) DO NOTHING;

-- Supabase Storage RLS 는 storage.objects 테이블에 정책으로 적용한다.

-- 공개 읽기 (bucket_id 필터만)
DROP POLICY IF EXISTS "preset_covers_read_all" ON storage.objects;
CREATE POLICY "preset_covers_read_all"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'preset-covers');

-- 업로드 (Phase 0: 인증 여부만 / 추후 지사 소속 체크로 좁힐 것)
DROP POLICY IF EXISTS "preset_covers_insert_auth" ON storage.objects;
CREATE POLICY "preset_covers_insert_auth"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'preset-covers');

-- 삭제 (Phase 0: 완화된 정책)
DROP POLICY IF EXISTS "preset_covers_delete_auth" ON storage.objects;
CREATE POLICY "preset_covers_delete_auth"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'preset-covers');

-- ---------------------------------------------------------------------
-- 3. PostgREST 스키마 리로드
-- ---------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
