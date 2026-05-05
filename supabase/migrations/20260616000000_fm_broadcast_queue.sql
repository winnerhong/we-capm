-- ============================================================================
-- Migration: 20260616000000_fm_broadcast_queue.sql
-- Purpose : tori_fm_requests 에 방송 대기 큐 + 재생 중 상태 추가.
--           status: PENDING/APPROVED/HIDDEN/PLAYED → +QUEUED, +PLAYING
--           queue_position: int NULL — QUEUED 큐의 순서 (작은 값이 먼저 재생)
-- Notes   : Idempotent. 기존 데이터(status) 영향 없음 — 신규 값만 추가.
-- ============================================================================

-- 기존 CHECK 제약 교체
ALTER TABLE tori_fm_requests
  DROP CONSTRAINT IF EXISTS tori_fm_requests_status_check;

ALTER TABLE tori_fm_requests
  ADD CONSTRAINT tori_fm_requests_status_check
  CHECK (status IN ('PENDING','APPROVED','QUEUED','PLAYING','HIDDEN','PLAYED'));

-- queue_position 컬럼
ALTER TABLE tori_fm_requests
  ADD COLUMN IF NOT EXISTS queue_position int NULL;

-- 큐 순서 정렬용 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_fm_requests_queue
  ON tori_fm_requests (session_id, queue_position)
  WHERE status = 'QUEUED';

-- PLAYING 한 세션에 1개만 보장 (부분 unique)
CREATE UNIQUE INDEX IF NOT EXISTS uq_fm_requests_playing_per_session
  ON tori_fm_requests (session_id)
  WHERE status = 'PLAYING';
