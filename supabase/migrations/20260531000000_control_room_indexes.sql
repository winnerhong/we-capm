-- ============================================================================
-- 20260531000000_control_room_indexes.sql
-- 기관포털 "관제실" 실시간 대시보드의 병렬 쿼리 6~8종을 위한 인덱스 보강.
-- 스키마 변경/RLS 변경 없이 인덱스만 추가. 모두 IF NOT EXISTS 멱등 처리.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) org_event_participants — 오늘(joined_at >= today 00:00) 가입자 카운트
--
-- 현재 상태:
--   - PRIMARY KEY (event_id, user_id)  : event_id 조인에는 쓸 수 있으나
--     joined_at range 필터에는 관여 불가.
--   - idx_org_event_p_user (user_id)   : 반대 방향.
--
-- 문제:
--   SELECT count(DISTINCT user_id)
--     FROM org_event_participants
--    WHERE event_id = ANY($1) AND joined_at >= date_trunc('day', now());
--   → event_id 별로 PK 스캔 후 joined_at 필터링 (팻 플래너가 seq scan 선택 가능).
--
-- 해결:
--   (event_id, joined_at DESC) 복합 인덱스. 오늘 가입자 조회뿐 아니라
--   행사별 최신 가입 N명 리스트에도 재사용 가능.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_org_event_p_event_joined
  ON public.org_event_participants (event_id, joined_at DESC);


-- ---------------------------------------------------------------------------
-- 2) chat_messages — 관제실 최근 채팅 20개
--
-- 현재 상태:
--   - chat_messages (room_id, created_at)  — 오름차순이라 DESC ORDER BY 는
--     backward scan 이 필요. is_deleted = false 필터도 미반영.
--
-- 해결:
--   (room_id, created_at DESC) WHERE is_deleted = false 부분 인덱스.
--   관제실 쿼리 패턴(room_id IN (...) AND is_deleted=false ORDER BY created_at DESC LIMIT 20)
--   에 정확히 매칭. 기존 인덱스는 다른 사용처(전체 메시지 로딩, soft-delete 포함)
--   가 있을 수 있어 남겨둠.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_chat_messages_room_live
  ON public.chat_messages (room_id, created_at DESC)
  WHERE is_deleted = false;


-- ---------------------------------------------------------------------------
-- 3) mission_submissions — PENDING_REVIEW 큐 (오래된 순 상위 10개)
--
-- 현재 상태:
--   - idx_mission_sub_pending (status) WHERE status='PENDING_REVIEW'
--       → status 단일 부분 인덱스. org_mission_id 범위 스캔은 힙 I/O 필요.
--   - idx_mission_sub_mission (org_mission_id)
--       → org_mission_id 단일. status 필터 재스캔.
--
-- 문제:
--   SELECT ... FROM mission_submissions
--    WHERE status='PENDING_REVIEW' AND org_mission_id = ANY($1)
--    ORDER BY submitted_at ASC LIMIT 10;
--   → 현재 인덱스 중 어느 것도 (org_mission_id, submitted_at) 정렬 제공 못함.
--
-- 해결:
--   (org_mission_id, submitted_at ASC) WHERE status='PENDING_REVIEW' 부분 복합.
--   PENDING_REVIEW 는 전체 submissions 중 적은 비율 → 부분 인덱스가 크기 작고 빠름.
--   ORDER BY submitted_at ASC 를 인덱스 정렬로 그대로 소비.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_mission_sub_pending_queue
  ON public.mission_submissions (org_mission_id, submitted_at ASC)
  WHERE status = 'PENDING_REVIEW';


-- ============================================================================
-- End of migration 20260531000000_control_room_indexes.sql
-- ============================================================================
