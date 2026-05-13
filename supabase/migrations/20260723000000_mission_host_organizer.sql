-- ============================================================================
-- Migration: 20260723000000_mission_host_organizer.sql
-- Purpose : 미션 단위로 "주최"/"주관" 자유 입력 필드.
--           스크린샷 참고: "주최: 구미혜당학교 / 주관: 위너키즈스포츠 [위너기획]"
--           행사 초대장의 host/organizer 가 출처(default)지만, 미션마다
--           override 가능하도록 별도 컬럼으로 저장.
-- ============================================================================

ALTER TABLE org_missions
  ADD COLUMN IF NOT EXISTS invitation_host      text NULL,
  ADD COLUMN IF NOT EXISTS invitation_organizer text NULL;

COMMENT ON COLUMN org_missions.invitation_host
  IS '미션 표시용 주최 — 자유 입력. 행사의 invitation_host 로 자동 기입되며 미션마다 덮어쓸 수 있음.';
COMMENT ON COLUMN org_missions.invitation_organizer
  IS '미션 표시용 주관 — 자유 입력. 행사의 invitation_organizer 로 자동 기입되며 미션마다 덮어쓸 수 있음.';

-- ============================================================================
-- End of migration 20260723000000_mission_host_organizer.sql
-- ============================================================================
