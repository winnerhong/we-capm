-- ============================================================
-- partner_orgs.fm_brand_name
--   기관별 토리FM 표시명. 빈 값이면 앱이 기본값 "토리FM" 으로 fallback.
--   예: "별밤지기", "힐스테이트 별밤지기", "OO어린이집 라디오"
-- ============================================================

ALTER TABLE partner_orgs
  ADD COLUMN IF NOT EXISTS fm_brand_name text;
