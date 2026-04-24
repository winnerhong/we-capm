-- =====================================================
-- Reviews Management Phase 1 (MVP)
-- - event_reviews에 답글(response_text/response_at) + 신고 플래그(is_flagged) 컬럼 추가
-- - 인덱스 보강
-- =====================================================

ALTER TABLE event_reviews ADD COLUMN IF NOT EXISTS response_text text;
ALTER TABLE event_reviews ADD COLUMN IF NOT EXISTS response_at timestamptz;
ALTER TABLE event_reviews ADD COLUMN IF NOT EXISTS is_flagged boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_event_reviews_event ON event_reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_event_reviews_rating ON event_reviews(rating);
