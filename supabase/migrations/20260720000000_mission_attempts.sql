-- ============================================================================
-- Migration: 20260720000000_mission_attempts.sql
-- Purpose : Phase 2 관제 — "지금 미션 수행 중" / "정체 가족" 추적용 telemetry.
--           참가자가 미션 페이지에 들어오면 한 row INSERT/UPDATE 하고
--           30초 heartbeat 로 살아있음 표시. 제출되면 completed_submission_id
--           로 마킹. 운영진은 last_seen_at 가 최근 N분 이내 + 미완료인 row 를
--           "지금 진행 중" 으로 본다.
-- Schema  :
--   - id (PK)
--   - org_id / user_id / org_mission_id  (FK, cascade)
--   - opened_at         : 최초/재개 시각
--   - last_seen_at      : heartbeat 갱신
--   - completed_submission_id  : 제출 완료 시 set
--   - UNIQUE (user_id, org_mission_id) — 가족당 미션 1행, upsert
-- Index   : (org_id, last_seen_at) WHERE completed_submission_id IS NULL
-- RLS     : permissive (Phase 0 패턴) — 서버 액션 레이어에서 권한 검증.
-- ============================================================================

CREATE TABLE IF NOT EXISTS mission_attempts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  org_mission_id uuid NOT NULL REFERENCES org_missions(id) ON DELETE CASCADE,
  opened_at     timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  completed_submission_id uuid REFERENCES mission_submissions(id) ON DELETE SET NULL,
  UNIQUE (user_id, org_mission_id)
);

CREATE INDEX IF NOT EXISTS idx_mission_attempts_org_active
  ON mission_attempts(org_id, last_seen_at DESC)
  WHERE completed_submission_id IS NULL;

COMMENT ON TABLE mission_attempts IS
  '참가자 미션 수행 중 telemetry — 관제실 라이브 위젯·정체 가족 감지에 사용.';

ALTER TABLE mission_attempts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_attempts_all" ON mission_attempts;
CREATE POLICY "mission_attempts_all" ON mission_attempts
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
