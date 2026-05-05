-- ============================================================================
-- Migration: 20260617000000_fm_song_bundle.sql
-- Purpose : 같은 노래(song_normalized) 사연을 묶어 NOW PLAYING 으로 띄우기 위해
--           세션당 PLAYING 1개 제약을 해제. 한 곡 묶음에 사연 N개가 동시에
--           PLAYING 상태가 될 수 있음.
-- Notes   : Idempotent. 이전 마이그레이션 (20260616) 의 부분 unique 인덱스 제거.
-- ============================================================================

DROP INDEX IF EXISTS uq_fm_requests_playing_per_session;

-- 곡 묶음 PLAYING 조회 최적화 — (session_id, status, song_normalized, created_at)
CREATE INDEX IF NOT EXISTS idx_fm_requests_playing_bundle
  ON tori_fm_requests (session_id, song_normalized, created_at)
  WHERE status = 'PLAYING';
