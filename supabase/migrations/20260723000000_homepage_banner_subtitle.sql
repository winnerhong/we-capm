-- ============================================================================
-- Migration: 20260723000000_homepage_banner_subtitle.sql
-- Purpose : 하단 홈페이지 배너에 메인 문구 위에 노출되는 "보조 안내문" 추가.
--           예: "더 많은 행사정보 및 체육수업이 궁금하시다면?" (subtitle)
--               "위너키즈스포츠 바로가기 →"                   (main text)
-- ============================================================================

ALTER TABLE partner_orgs
  ADD COLUMN IF NOT EXISTS homepage_banner_subtitle text;

COMMENT ON COLUMN partner_orgs.homepage_banner_subtitle
  IS '하단 배너 메인 문구 위에 작게 노출되는 보조 안내문. 비우면 안 보임.';

NOTIFY pgrst, 'reload schema';
