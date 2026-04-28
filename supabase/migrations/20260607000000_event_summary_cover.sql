-- ============================================================================
-- Add cover_image_url to view_org_event_summary
-- 행사 카드에서 커버 이미지를 표시하기 위해 뷰 확장.
-- Postgres CREATE OR REPLACE VIEW 제약: 기존 컬럼 사이에 새 컬럼을 끼울 수 없음.
-- 신규 컬럼은 반드시 맨 끝에만 추가 가능 (quest_pack_count 등 기존 순서 유지).
-- ============================================================================

CREATE OR REPLACE VIEW view_org_event_summary AS
SELECT
  e.id              AS event_id,
  e.org_id,
  e.name,
  e.status,
  e.starts_at,
  e.ends_at,
  (SELECT count(*)::int FROM org_event_quest_packs  WHERE event_id = e.id) AS quest_pack_count,
  (SELECT count(*)::int FROM org_event_participants WHERE event_id = e.id) AS participant_count,
  (SELECT count(*)::int FROM tori_fm_sessions       WHERE event_id = e.id) AS fm_session_count,
  (SELECT count(*)::int FROM org_event_programs     WHERE event_id = e.id) AS program_count,
  (SELECT count(*)::int FROM org_event_trails       WHERE event_id = e.id) AS trail_count,
  e.cover_image_url AS cover_image_url
FROM org_events e;
