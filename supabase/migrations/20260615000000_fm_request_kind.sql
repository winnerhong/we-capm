-- ============================================================================
-- Migration: 20260615000000_fm_request_kind.sql
-- Purpose : tori_fm_requests 에 kind / is_anonymous 컬럼 추가.
--           - kind = 'song_request' (기본): 신청곡+사연 (기존 동작)
--           - kind = 'story_only'  : 사연만, 익명 처리 가능
--           song_title 을 nullable 로 — story_only 는 곡명 없음.
--           기존 인기 신청곡/가수 view 는 'song_request' 만 포함하도록 수정.
-- Notes   : Idempotent (IF NOT EXISTS). RLS 변경 없음.
-- ============================================================================

ALTER TABLE tori_fm_requests
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'song_request',
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- CHECK 제약 — 이미 있으면 무시 (DO 블록으로 안전 처리)
DO $$
BEGIN
  ALTER TABLE tori_fm_requests
    ADD CONSTRAINT tori_fm_requests_kind_check
    CHECK (kind IN ('song_request','story_only'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- song_title NULL 허용 (story_only 는 곡명 없음)
ALTER TABLE tori_fm_requests
  ALTER COLUMN song_title DROP NOT NULL;

-- 인덱스 — kind 기반 조회 최적화
CREATE INDEX IF NOT EXISTS idx_fm_requests_kind
  ON tori_fm_requests (session_id, kind, created_at DESC);

-- ---------------------------------------------------------------------------
-- View 갱신 — 기존 view 들이 song_title 을 GROUP BY 에 사용하므로 NULL 진입 차단.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW view_fm_top_songs_today AS
SELECT
  session_id,
  song_title,
  coalesce(artist, '(가수 미입력)') AS artist,
  count(*)::int                      AS request_count,
  coalesce(sum(heart_count), 0)::int AS total_hearts
FROM tori_fm_requests
WHERE created_at >= date_trunc('day', now())
  AND status != 'HIDDEN'
  AND kind = 'song_request'
  AND song_title IS NOT NULL
GROUP BY session_id, song_title, artist
ORDER BY request_count DESC, total_hearts DESC;

CREATE OR REPLACE VIEW view_fm_top_artists_today AS
SELECT
  session_id,
  coalesce(artist, '(미지정)') AS artist,
  count(*)::int                AS request_count,
  coalesce(sum(heart_count), 0)::int AS total_hearts
FROM tori_fm_requests
WHERE created_at >= date_trunc('day', now())
  AND status != 'HIDDEN'
  AND kind = 'song_request'
  AND artist IS NOT NULL
GROUP BY session_id, artist
ORDER BY request_count DESC;

-- ---------------------------------------------------------------------------
-- 신규 view — 익명 사연 TOP (heart_count 내림차순)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE VIEW view_fm_top_anonymous_stories_today AS
SELECT
  r.id          AS request_id,
  r.session_id,
  r.user_id,
  r.story,
  r.heart_count,
  r.created_at
FROM tori_fm_requests r
WHERE r.created_at >= date_trunc('day', now())
  AND r.status != 'HIDDEN'
  AND r.kind = 'story_only'
  AND r.story IS NOT NULL
  AND length(trim(r.story)) > 0
ORDER BY r.heart_count DESC, r.created_at DESC;
