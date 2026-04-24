-- =====================================================
-- Mission System Phase 3 — 협동(COOP) / 돌발(BROADCAST) 미션
-- 자립형 마이그레이션: 모든 구문 멱등성 확보 (재실행 안전).
--   mission_coop_sessions : 2인 페어링 기반 협동 미션 세션
--   mission_broadcasts    : 운영자가 발동하는 돌발(제한시간) 미션
-- Phase 0 RLS: 전체 허용(permissive). Phase X 에서 auth.uid() / 기관 클레임 기반으로 조임.
-- NOTE: Phase 1 마이그레이션(20260515000000)이 만든 public.set_updated_at() 트리거 함수를 재사용.
-- NOTE: mission_broadcasts.target_event_id 는 events(id) 를 느슨하게 참조 (FK 미설정).
-- =====================================================


-- ---------------------------------------------------------------
-- 1) mission_coop_sessions (협동 미션 페어링 세션)
-- ---------------------------------------------------------------
-- state machine:
--   WAITING   : initiator 만 생성된 상태 (pair_code 발급, partner 대기)
--   PAIRED    : partner 가 코드 입력 후 매칭 완료 (양측 제출 가능)
--   A_DONE    : initiator 측 제출 완료 (partner 제출 대기)
--   B_DONE    : partner 측 제출 완료 (initiator 제출 대기)
--   COMPLETED : 양측 제출 완료 (completed_at 기록)
--   EXPIRED   : expires_at 초과 — cron/애플리케이션이 전이
--   CANCELLED : initiator 또는 스태프가 취소
-- pair_code: 6자리 base32 (A-Z excl I,O + 2-9), 종이 QR + 수기 입력 겸용 → UNIQUE.
CREATE TABLE IF NOT EXISTS mission_coop_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_mission_id uuid NOT NULL REFERENCES org_missions(id) ON DELETE CASCADE,
  pair_code text NOT NULL UNIQUE,
  initiator_user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  initiator_child_id uuid REFERENCES app_children(id) ON DELETE SET NULL,
  partner_user_id uuid REFERENCES app_users(id) ON DELETE CASCADE,
  partner_child_id uuid REFERENCES app_children(id) ON DELETE SET NULL,
  state text NOT NULL DEFAULT 'WAITING'
    CHECK (state IN ('WAITING','PAIRED','A_DONE','B_DONE','COMPLETED','EXPIRED','CANCELLED')),
  shared_photo_url text,
  initiator_submission_id uuid REFERENCES mission_submissions(id) ON DELETE SET NULL,
  partner_submission_id uuid REFERENCES mission_submissions(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL,
  paired_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 미션별 상태 조회(모더레이션/대시보드)
CREATE INDEX IF NOT EXISTS idx_coop_sessions_mission_state
  ON mission_coop_sessions (org_mission_id, state);

-- initiator 본인의 진행 중 세션 조회 (종료 상태 제외)
CREATE INDEX IF NOT EXISTS idx_coop_sessions_initiator
  ON mission_coop_sessions (initiator_user_id)
  WHERE state IN ('WAITING','PAIRED','A_DONE','B_DONE');

-- partner 본인의 진행 중 세션 조회 (종료 상태 제외)
CREATE INDEX IF NOT EXISTS idx_coop_sessions_partner
  ON mission_coop_sessions (partner_user_id)
  WHERE partner_user_id IS NOT NULL AND state IN ('PAIRED','A_DONE','B_DONE');

-- 만료 스윕(expire cron) 전용 — 진행 중 세션만 스캔
CREATE INDEX IF NOT EXISTS idx_coop_sessions_expires
  ON mission_coop_sessions (expires_at)
  WHERE state IN ('WAITING','PAIRED','A_DONE','B_DONE');


-- ---------------------------------------------------------------
-- 2) mission_broadcasts (돌발 미션 발동 기록)
-- ---------------------------------------------------------------
-- target_event_id: events(id) 를 느슨하게 참조 (FK 미설정 — 결합도 최소화).
-- duration_sec: 30초 ~ 1시간 범위 제한.
-- prompt_snapshot: 발동 시점의 org_missions.config.prompt 를 복사 — 원본 수정 후에도 이력 보존.
CREATE TABLE IF NOT EXISTS mission_broadcasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_mission_id uuid NOT NULL REFERENCES org_missions(id) ON DELETE CASCADE,
  triggered_by_org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  target_scope text NOT NULL DEFAULT 'ORG'
    CHECK (target_scope IN ('ORG','EVENT','ALL')),
  target_event_id uuid,
  prompt_snapshot text NOT NULL,
  duration_sec int NOT NULL CHECK (duration_sec >= 30 AND duration_sec <= 3600),
  fires_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 기관별 발동 이력 + 라이브 필터 (애플리케이션에서 expires_at > now() 추가 필터).
-- NOTE: `WHERE expires_at > now()` 는 now() 가 non-IMMUTABLE 이므로
--       partial index predicate 에 쓸 수 없음 → 애플리케이션에서 필터링.
CREATE INDEX IF NOT EXISTS idx_broadcasts_org_live
  ON mission_broadcasts (triggered_by_org_id, expires_at)
  WHERE cancelled_at IS NULL;

-- 미션별 발동 이력
CREATE INDEX IF NOT EXISTS idx_broadcasts_mission
  ON mission_broadcasts (org_mission_id, fires_at DESC);


-- ---------------------------------------------------------------
-- 3) RLS — Phase 0: 전체 허용 (추후 조임)
-- ---------------------------------------------------------------
ALTER TABLE mission_coop_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_coop_sessions_all" ON mission_coop_sessions;
CREATE POLICY "mission_coop_sessions_all" ON mission_coop_sessions
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — initiator/partner 본인 또는 org 스태프만 조회/수정

ALTER TABLE mission_broadcasts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_broadcasts_all" ON mission_broadcasts;
CREATE POLICY "mission_broadcasts_all" ON mission_broadcasts
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — 같은 org 참여자 조회 / org 운영자만 INSERT/UPDATE


-- ---------------------------------------------------------------
-- 4) updated_at 트리거 (Phase 1 의 public.set_updated_at() 재사용)
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_mission_coop_sessions_updated_at ON mission_coop_sessions;
CREATE TRIGGER trg_mission_coop_sessions_updated_at
  BEFORE UPDATE ON mission_coop_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mission_broadcasts 는 updated_at 컬럼 없음 — 트리거 미부착.


-- ---------------------------------------------------------------
-- 5) Supabase Realtime publication 등록
--    ALTER PUBLICATION ADD TABLE 은 이미 추가된 경우 duplicate_object 예외 발생 → 무시.
--    (publication 이 존재하지 않는 환경일 수도 있어 undefined_object 도 방어)
-- ---------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mission_coop_sessions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mission_broadcasts;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;


-- =====================================================
-- End of Phase 3 migration
-- =====================================================
