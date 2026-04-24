-- ============================================================================
-- Migration: 20260525000000_app_users_attendance.sql
-- Purpose : 참가자별 출석 상태 체크 (당일 기준 roll call)
--           PRESENT(참석) · LATE(늦음) · ABSENT(미참석)
--           날짜가 오늘이 아니면 UI 에서 '미체크' 취급해서 자연 리셋.
-- ============================================================================

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS attendance_status text
    CHECK (
      attendance_status IS NULL
      OR attendance_status IN ('PRESENT', 'LATE', 'ABSENT')
    );

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS attendance_date date;

-- 기관별 오늘 출석 조회 최적화
CREATE INDEX IF NOT EXISTS idx_app_users_attendance
  ON app_users (org_id, attendance_date)
  WHERE attendance_status IS NOT NULL;

-- ============================================================================
-- 실행 후 반드시 함께:
--   NOTIFY pgrst, 'reload schema';
-- ============================================================================
