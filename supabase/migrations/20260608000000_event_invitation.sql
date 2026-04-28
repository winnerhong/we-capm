-- ============================================================================
-- Event invitation card 필드
-- 기관이 행사별로 초대장(인사말 / 장소 / 준비물 / 발행 토글)을 작성하면
-- 참가자가 /invite/{eventId} 라우트에서 본인 정보가 결합된 초대장을 보게 됨.
-- ============================================================================

ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS invitation_message text,
  ADD COLUMN IF NOT EXISTS invitation_location text,
  ADD COLUMN IF NOT EXISTS invitation_dress_code text,
  ADD COLUMN IF NOT EXISTS invitation_published_at timestamptz;

COMMENT ON COLUMN org_events.invitation_message IS
  '초대장 환영 인사말 (예: "함께 즐거운 시간을 만들어요"). 비어 있으면 기본 문구 사용.';
COMMENT ON COLUMN org_events.invitation_location IS
  '초대장에 표시할 장소 텍스트 (자유 입력). 카카오맵 검색 링크 자동 생성.';
COMMENT ON COLUMN org_events.invitation_dress_code IS
  '복장·준비물 안내 (예: "편한 운동복, 물병 지참").';
COMMENT ON COLUMN org_events.invitation_published_at IS
  '초대장 발행 시점. NULL 이면 초안 — 참가자가 링크 클릭해도 "준비 중" 안내가 노출됨.';
