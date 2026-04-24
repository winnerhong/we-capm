-- ============================================================
-- org_events: 참가자 자체 가입 허용 플래그
-- ------------------------------------------------------------
--   기본값 false — 기존 데이터는 변경 없이 기관 bulk-import 필수
--   true 로 설정된 행사는 /join/event/{id} 에서
--   미등록 전화번호로도 가입 가능 (이름 필수)
-- ============================================================

ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS allow_self_register boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN org_events.allow_self_register IS
  '초대링크 경유 self-register 허용. false 면 기관 bulk-import 된 번호만 참여 가능';

-- allow_self_register=true 행사만 빠르게 필터하기 위한 부분 인덱스
CREATE INDEX IF NOT EXISTS idx_org_events_self_register
  ON org_events (id)
  WHERE allow_self_register = true;

NOTIFY pgrst, 'reload schema';
