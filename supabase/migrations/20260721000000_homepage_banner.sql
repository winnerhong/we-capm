-- ============================================================================
-- Migration: 20260721000000_homepage_banner.sql
-- Purpose : 기관별 "하단 홈페이지 배너" 설정 — 참가자 토리로 사이트 하단·
--           초대장 페이지 하단에 노출되는 외부 사이트 링크 배너.
-- ============================================================================

ALTER TABLE partner_orgs
  ADD COLUMN IF NOT EXISTS homepage_banner_text       text,
  ADD COLUMN IF NOT EXISTS homepage_banner_url        text,
  ADD COLUMN IF NOT EXISTS homepage_banner_image_url  text;

COMMENT ON COLUMN partner_orgs.homepage_banner_text       IS '하단 배너 문구. NULL/빈문자면 배너 비노출.';
COMMENT ON COLUMN partner_orgs.homepage_banner_url        IS '배너 클릭 시 이동할 URL (https://...). NULL 이어도 텍스트만 노출.';
COMMENT ON COLUMN partner_orgs.homepage_banner_image_url  IS '배너 배경 이미지 URL (권장 720x120). NULL 이면 기본 그라데이션.';

NOTIFY pgrst, 'reload schema';
