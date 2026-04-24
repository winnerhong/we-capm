-- ============================================================
-- partner_trails 필드 확장: 장소·주소·링크·비고·추가 이미지
-- ============================================================

ALTER TABLE partner_trails ADD COLUMN IF NOT EXISTS venue_name text;
ALTER TABLE partner_trails ADD COLUMN IF NOT EXISTS venue_address text;
ALTER TABLE partner_trails ADD COLUMN IF NOT EXISTS external_link text;
ALTER TABLE partner_trails ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE partner_trails ADD COLUMN IF NOT EXISTS images text[] NOT NULL DEFAULT '{}';
