-- =====================================================
-- Mission System Phase 2 — 보물찾기/토리FM 신청곡/방송 세션
-- 자립형 마이그레이션: 모든 구문 멱등성 확보 (재실행 안전).
--   mission_treasure_progress : 보물찾기 단계별 잠금 해제 진척
--   mission_radio_queue       : 신청곡 모더레이션 큐 (방송 대기/재생/스킵)
--   tori_fm_sessions          : 토리FM 방송 세션 (일일 점심방송 등)
-- Phase 0 RLS: 전체 허용(permissive). Phase X 에서 auth.uid() / 기관 클레임 기반으로 조임.
-- NOTE: Phase 1 마이그레이션(20260515000000)이 만든 public.set_updated_at() 트리거 함수를 재사용.
-- NOTE: mission_radio_queue.fm_session_id → tori_fm_sessions.id 의 FK 는
--       양 테이블이 같은 트랜잭션에서 생성되므로 "나중에" DO 블록으로 추가.
-- =====================================================


-- ---------------------------------------------------------------
-- 1) mission_treasure_progress (보물찾기 단계별 진척)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_treasure_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_mission_id uuid NOT NULL REFERENCES org_missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  step_order int NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  unlock_method text CHECK (unlock_method IN ('AUTO','QR','ANSWER') OR unlock_method IS NULL),
  CONSTRAINT mission_treasure_progress_unique UNIQUE (org_mission_id, user_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_treasure_progress_user_mission
  ON mission_treasure_progress (user_id, org_mission_id, step_order);


-- ---------------------------------------------------------------
-- 2) mission_radio_queue (신청곡 모더레이션 큐)
-- ---------------------------------------------------------------
-- fm_session_id FK 는 tori_fm_sessions 생성 이후 DO 블록에서 추가.
CREATE TABLE IF NOT EXISTS mission_radio_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES mission_submissions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  fm_session_id uuid,
  moderation text NOT NULL DEFAULT 'PENDING'
    CHECK (moderation IN ('PENDING','APPROVED','HIDDEN')),
  position int,
  played_at timestamptz,
  skipped_at timestamptz,
  play_duration_sec int,
  moderator_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT mission_radio_queue_submission_unique UNIQUE (submission_id)
);

CREATE INDEX IF NOT EXISTS idx_radio_queue_org_status
  ON mission_radio_queue (org_id, moderation);

CREATE INDEX IF NOT EXISTS idx_radio_queue_session
  ON mission_radio_queue (fm_session_id, position);


-- ---------------------------------------------------------------
-- 3) tori_fm_sessions (토리FM 방송 세션)
-- ---------------------------------------------------------------
-- event_id: events(id) 를 느슨하게 참조 (FK 미설정 — 결합도 최소화).
CREATE TABLE IF NOT EXISTS tori_fm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  event_id uuid,
  name text NOT NULL DEFAULT '토리FM 점심방송',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  is_live boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  ended_at timestamptz,
  current_queue_id uuid REFERENCES mission_radio_queue(id) ON DELETE SET NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_sessions_org_live
  ON tori_fm_sessions (org_id, is_live);

CREATE INDEX IF NOT EXISTS idx_fm_sessions_scheduled
  ON tori_fm_sessions (scheduled_start, scheduled_end);


-- ---------------------------------------------------------------
-- 4) 지연 FK: mission_radio_queue.fm_session_id → tori_fm_sessions.id
-- ---------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'mission_radio_queue_fm_session_fkey'
  ) THEN
    ALTER TABLE mission_radio_queue
      ADD CONSTRAINT mission_radio_queue_fm_session_fkey
      FOREIGN KEY (fm_session_id) REFERENCES tori_fm_sessions(id) ON DELETE SET NULL;
  END IF;
END $$;


-- ---------------------------------------------------------------
-- 5) RLS — Phase 0: 전체 허용 (추후 조임)
-- ---------------------------------------------------------------
ALTER TABLE mission_treasure_progress ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_treasure_progress_all" ON mission_treasure_progress;
CREATE POLICY "mission_treasure_progress_all" ON mission_treasure_progress
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — user_id = auth.uid() 또는 org 스태프만 조회

ALTER TABLE mission_radio_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_radio_queue_all" ON mission_radio_queue;
CREATE POLICY "mission_radio_queue_all" ON mission_radio_queue
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — APPROVED 만 공개, PENDING/HIDDEN 은 모더레이터 전용

ALTER TABLE tori_fm_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tori_fm_sessions_all" ON tori_fm_sessions;
CREATE POLICY "tori_fm_sessions_all" ON tori_fm_sessions
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — 같은 org 참여자/스태프만


-- ---------------------------------------------------------------
-- 6) updated_at 트리거 (Phase 1 의 public.set_updated_at() 재사용)
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_mission_radio_queue_updated_at ON mission_radio_queue;
CREATE TRIGGER trg_mission_radio_queue_updated_at
  BEFORE UPDATE ON mission_radio_queue
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tori_fm_sessions_updated_at ON tori_fm_sessions;
CREATE TRIGGER trg_tori_fm_sessions_updated_at
  BEFORE UPDATE ON tori_fm_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- mission_treasure_progress 는 updated_at 컬럼 없음 — 트리거 미부착.


-- ---------------------------------------------------------------
-- 7) Supabase Realtime publication 등록
--    ALTER PUBLICATION ADD TABLE 은 이미 추가된 경우 duplicate_object 예외 발생 → 무시.
--    (publication 이 존재하지 않는 환경일 수도 있어 undefined_object 도 방어)
-- ---------------------------------------------------------------
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mission_radio_queue;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE tori_fm_sessions;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE mission_treasure_progress;
  EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
  END;
END $$;


-- =====================================================
-- End of Phase 2 migration
-- =====================================================
