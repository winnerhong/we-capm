-- ============================================================================
-- Migration: 20260722000000_event_host_organizer.sql
-- Purpose : 행사 초대장에 "주최" / "주관" 자유 입력 필드 추가.
--           스크린샷 참고: "주최: 구미혜당학교 / 주관: 위너키즈스포츠 [위너기획]"
--           행사 단위로 다르므로 org/partner 자동 매핑이 아닌 자유 입력.
-- ============================================================================

ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS invitation_host      text NULL,
  ADD COLUMN IF NOT EXISTS invitation_organizer text NULL;

COMMENT ON COLUMN org_events.invitation_host
  IS '초대장 표시용 주최 — 자유 입력. 예: 구미혜당학교. 비우면 초대장에서 줄 자체 숨김.';
COMMENT ON COLUMN org_events.invitation_organizer
  IS '초대장 표시용 주관 — 자유 입력. 예: 위너키즈스포츠 [위너기획]. 비우면 줄 자체 숨김.';

-- ============================================================================
-- End of migration 20260722000000_event_host_organizer.sql
-- ============================================================================
