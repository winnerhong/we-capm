-- ============================================================================
-- Migration: 20260618000000_program_parking_meeting.sql
-- Purpose : 프로그램(partner_programs / org_programs) 에 주차장 정보 + 집결장소 추가
-- Notes   : 멱등(IF NOT EXISTS). 기존 row 는 모두 빈 배열 / NULL 로 시작.
--           parking_lots: ParkingLot[] (최대 10개, 앱 레이어 검증)
--           meeting_point: MeetingPoint | null (단일 객체)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) partner_programs (파트너 마스터 프로그램)
-- ---------------------------------------------------------------------------
ALTER TABLE partner_programs
  ADD COLUMN IF NOT EXISTS parking_lots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meeting_point jsonb NULL;

COMMENT ON COLUMN partner_programs.parking_lots IS
  '주차장 배열. 각 항목: {name, address, capacity?, fee?, note?}. 최대 10개 (앱 검증).';
COMMENT ON COLUMN partner_programs.meeting_point IS
  '집결장소(단일). {name, address, time?, note?}. NULL 허용.';

-- ---------------------------------------------------------------------------
-- 2) org_programs (기관이 활성화한 프로그램)
-- ---------------------------------------------------------------------------
ALTER TABLE org_programs
  ADD COLUMN IF NOT EXISTS parking_lots jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meeting_point jsonb NULL;

COMMENT ON COLUMN org_programs.parking_lots IS
  '주차장 배열. 각 항목: {name, address, capacity?, fee?, note?}. 최대 10개.';
COMMENT ON COLUMN org_programs.meeting_point IS
  '집결장소(단일). {name, address, time?, note?}. NULL 허용.';
