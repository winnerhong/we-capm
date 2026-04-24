-- ============================================================
-- 프로그램 카테고리 자유 입력 허용
-- 기존 6개 CHECK 제약 해제 → 파트너가 직접 카테고리 생성 가능
-- ============================================================

ALTER TABLE partner_programs DROP CONSTRAINT IF EXISTS partner_programs_category_check;

-- 최소한의 검증 (빈 문자열/너무 긴 값 차단)
ALTER TABLE partner_programs ADD CONSTRAINT partner_programs_category_check
  CHECK (char_length(category) BETWEEN 1 AND 60);

-- org_programs도 동일하게 (기관 복사본)
ALTER TABLE org_programs DROP CONSTRAINT IF EXISTS org_programs_category_check;
ALTER TABLE org_programs ADD CONSTRAINT org_programs_category_check
  CHECK (char_length(category) BETWEEN 1 AND 60);
