-- ============================================================================
-- Migration: 20260724000000_homepage_banner_footer.sql
-- Purpose : 하단 홈페이지 배너 아래에 노출되는 "지사 푸터" 영역.
--           예: WE ARE THE WINNER / 위너키즈스포츠 · 1800-7581 / (주) 위너그룹
--           - brand : 강조 (uppercase, tracking-wide).
--           - meta  : 여러 줄 자유 텍스트 (회사명·번호·법인 등).
-- ============================================================================

ALTER TABLE partner_orgs
  ADD COLUMN IF NOT EXISTS homepage_banner_footer_brand text,
  ADD COLUMN IF NOT EXISTS homepage_banner_footer_meta  text;

COMMENT ON COLUMN partner_orgs.homepage_banner_footer_brand
  IS '배너 아래 푸터 강조 한 줄 (uppercase 스타일). 예: WE ARE THE WINNER';
COMMENT ON COLUMN partner_orgs.homepage_banner_footer_meta
  IS '배너 아래 푸터 본문 — 줄바꿈 그대로 표시. 회사명/연락처/법인 등 자유.';

NOTIFY pgrst, 'reload schema';
