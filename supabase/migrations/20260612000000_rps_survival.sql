-- ============================================================================
-- Migration: 20260612000000_rps_survival.sql
-- Purpose : 단체 가위바위보 서바이벌 게임
--           (rooms / rounds / picks / participants / gifts)
-- Depends : partner_orgs, org_events, app_users (소프트 참조 — FK는 일부만)
-- Notes   : Fully idempotent. Phase 0 permissive RLS (TODO: tighten in Phase 1).
--           Realtime 활성화: REPLICA IDENTITY FULL + supabase_realtime publication.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) rps_rooms — 게임방
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rps_rooms (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id            uuid NOT NULL,
  event_id          uuid NULL REFERENCES org_events(id) ON DELETE SET NULL,
  fm_session_id     uuid NULL REFERENCES tori_fm_sessions(id) ON DELETE SET NULL,
  host_user_id      uuid NULL,
  title             text NOT NULL DEFAULT '단체 가위바위보',
  target_survivors  int  NOT NULL CHECK (target_survivors > 0),
  status            text NOT NULL DEFAULT 'idle'
                      CHECK (status IN ('idle','running','finished','cancelled')),
  current_round_no  int  NOT NULL DEFAULT 0,
  pick_window_ms    int  NOT NULL DEFAULT 3000,
  created_at        timestamptz NOT NULL DEFAULT now(),
  finished_at       timestamptz NULL
);

-- 기존 테이블에 추가되는 환경 대응 (IF NOT EXISTS)
ALTER TABLE rps_rooms
  ADD COLUMN IF NOT EXISTS fm_session_id uuid NULL REFERENCES tori_fm_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rps_rooms_org_status
  ON rps_rooms (org_id, status);
CREATE INDEX IF NOT EXISTS idx_rps_rooms_event
  ON rps_rooms (event_id);
CREATE INDEX IF NOT EXISTS idx_rps_rooms_fm_session
  ON rps_rooms (fm_session_id);
CREATE INDEX IF NOT EXISTS idx_rps_rooms_created
  ON rps_rooms (created_at DESC);

ALTER TABLE rps_rooms ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): SELECT 모두 가능 / INSERT·UPDATE·DELETE는 host_user_id 또는
-- org staff·admin 만. 종료된 방은 admin만 삭제.
DROP POLICY IF EXISTS "rps_rooms_all" ON rps_rooms;
CREATE POLICY "rps_rooms_all" ON rps_rooms
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) rps_rounds — 라운드
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rps_rounds (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id             uuid NOT NULL REFERENCES rps_rooms(id) ON DELETE CASCADE,
  round_no            int  NOT NULL,
  starts_at           timestamptz NOT NULL,
  locked_at           timestamptz NOT NULL,
  host_pick           text NULL CHECK (host_pick IN ('rock','paper','scissors')),
  resolved_at         timestamptz NULL,
  participants_count  int  NOT NULL DEFAULT 0,
  survivors_count     int  NOT NULL DEFAULT 0,
  is_revival          boolean NOT NULL DEFAULT false,
  UNIQUE (room_id, round_no)
);

CREATE INDEX IF NOT EXISTS idx_rps_rounds_room
  ON rps_rounds (room_id, round_no DESC);

ALTER TABLE rps_rounds ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT/UPDATE 는 방의 host 또는 staff·admin 으로 제한.
-- SELECT 는 누구나 (관전 허용).
DROP POLICY IF EXISTS "rps_rounds_all" ON rps_rounds;
CREATE POLICY "rps_rounds_all" ON rps_rounds
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) rps_picks — 픽
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rps_picks (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id      uuid NOT NULL REFERENCES rps_rounds(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  display_name  text NOT NULL,
  pick          text NOT NULL CHECK (pick IN ('rock','paper','scissors')),
  picked_at     timestamptz NOT NULL DEFAULT now(),
  outcome       text NULL CHECK (outcome IN ('win','lose','tie')),
  UNIQUE (round_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rps_picks_round
  ON rps_picks (round_id);
CREATE INDEX IF NOT EXISTS idx_rps_picks_user
  ON rps_picks (user_id);

ALTER TABLE rps_picks ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT 는 auth.uid() == user_id 이고 라운드가 락 전일 때만.
-- UPDATE(outcome) 는 서버(서비스 롤) 또는 host 만. DELETE 금지.
DROP POLICY IF EXISTS "rps_picks_all" ON rps_picks;
CREATE POLICY "rps_picks_all" ON rps_picks
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4) rps_participants — 방 참가자 (게임 진행 상태)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rps_participants (
  room_id              uuid NOT NULL REFERENCES rps_rooms(id) ON DELETE CASCADE,
  user_id              uuid NOT NULL,
  display_name         text NOT NULL,
  phone                text NULL,
  joined_at            timestamptz NOT NULL DEFAULT now(),
  is_active            boolean NOT NULL DEFAULT true,
  eliminated_at_round  int  NULL,
  finished_rank        int  NULL,
  PRIMARY KEY (room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_rps_participants_active
  ON rps_participants (room_id, is_active);
CREATE INDEX IF NOT EXISTS idx_rps_participants_rank
  ON rps_participants (room_id, finished_rank)
  WHERE finished_rank IS NOT NULL;

ALTER TABLE rps_participants ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT 는 auth.uid() == user_id 본인만 (셀프 조인).
-- UPDATE(is_active, eliminated_at_round, finished_rank) 는 host·staff·admin.
DROP POLICY IF EXISTS "rps_participants_all" ON rps_participants;
CREATE POLICY "rps_participants_all" ON rps_participants
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5) rps_gifts — 우승자 선물 발송 기록
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rps_gifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       uuid NOT NULL REFERENCES rps_rooms(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL,
  display_name  text NOT NULL,
  phone         text NOT NULL,
  gift_label    text NOT NULL,
  gift_url      text NULL,
  message       text NULL,
  sent_at       timestamptz NULL,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','sent','failed')),
  error         text NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rps_gifts_room_status
  ON rps_gifts (room_id, status);
CREATE INDEX IF NOT EXISTS idx_rps_gifts_user
  ON rps_gifts (user_id);

ALTER TABLE rps_gifts ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): SELECT/INSERT/UPDATE 는 host·staff·admin 만.
-- 본인 user_id 의 행은 SELECT 가능 (자기 선물 상태 조회).
DROP POLICY IF EXISTS "rps_gifts_all" ON rps_gifts;
CREATE POLICY "rps_gifts_all" ON rps_gifts
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Realtime: REPLICA IDENTITY FULL + supabase_realtime publication
-- (publication ADD 는 IF NOT EXISTS 미지원 → DO 블록으로 예외 흡수)
-- ---------------------------------------------------------------------------
ALTER TABLE rps_rooms        REPLICA IDENTITY FULL;
ALTER TABLE rps_rounds       REPLICA IDENTITY FULL;
ALTER TABLE rps_picks        REPLICA IDENTITY FULL;
ALTER TABLE rps_participants REPLICA IDENTITY FULL;
ALTER TABLE rps_gifts        REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rps_rooms;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rps_rounds;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rps_picks;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rps_participants;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE rps_gifts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ============================================================================
-- End of migration 20260612000000_rps_survival.sql
-- ============================================================================
