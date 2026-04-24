-- ============================================================================
-- Migration: 20260523000000_org_events.sql
-- Purpose : Org Events (기관 행사) — B2B2C event container binding participants
--           to tools (stamp books / programs / trails / FM sessions) over a
--           time window. M:N joins for quest packs, programs, trails,
--           participants; 1:N for FM sessions (event_id column added).
-- Depends : partner_orgs, org_quest_packs, org_programs, partner_trails,
--           app_users, tori_fm_sessions
-- Notes   : Fully idempotent. Phase 0 permissive RLS (TODO(phase1): tighten).
--           Tables created:
--             1) org_events                 (행사 루트)
--             2) org_event_quest_packs      (행사 <-> 스탬프북)
--             3) org_event_programs         (행사 <-> 프로그램)
--             4) org_event_trails           (행사 <-> 숲길)
--             5) org_event_participants     (행사 <-> 참가자)
--             6) tori_fm_sessions.event_id  (column, 1:N)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) org_events — root event container
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  name            text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  description     text NULL,
  starts_at       timestamptz NULL,
  ends_at         timestamptz NULL,
  cover_image_url text NULL,
  status          text NOT NULL DEFAULT 'DRAFT'
                    CHECK (status IN ('DRAFT','LIVE','ENDED','ARCHIVED')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_events_org
  ON org_events (org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_org_events_status
  ON org_events (org_id, status);

-- updated_at auto-touch trigger (table-local function; safe CREATE OR REPLACE)
CREATE OR REPLACE FUNCTION touch_org_events_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_org_events ON org_events;
CREATE TRIGGER trg_touch_org_events
  BEFORE UPDATE ON org_events
  FOR EACH ROW EXECUTE FUNCTION touch_org_events_updated_at();

ALTER TABLE org_events ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): restrict SELECT to the owning partner_org's members/participants;
-- restrict INSERT/UPDATE/DELETE to partner_org admins and platform admins.
DROP POLICY IF EXISTS "org_events_all" ON org_events;
CREATE POLICY "org_events_all" ON org_events
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) org_event_quest_packs — 행사 <-> 스탬프북 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_event_quest_packs (
  event_id      uuid NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  quest_pack_id uuid NOT NULL REFERENCES org_quest_packs(id) ON DELETE CASCADE,
  sort_order    int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, quest_pack_id)
);

CREATE INDEX IF NOT EXISTS idx_org_event_qp_pack
  ON org_event_quest_packs (quest_pack_id);

ALTER TABLE org_event_quest_packs ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): gate writes on the parent org_event's org membership.
DROP POLICY IF EXISTS "org_event_quest_packs_all" ON org_event_quest_packs;
CREATE POLICY "org_event_quest_packs_all" ON org_event_quest_packs
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) org_event_programs — 행사 <-> 프로그램 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_event_programs (
  event_id       uuid NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  org_program_id uuid NOT NULL REFERENCES org_programs(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, org_program_id)
);

CREATE INDEX IF NOT EXISTS idx_org_event_programs_prog
  ON org_event_programs (org_program_id);

ALTER TABLE org_event_programs ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): gate writes on the parent org_event's org membership.
DROP POLICY IF EXISTS "org_event_programs_all" ON org_event_programs;
CREATE POLICY "org_event_programs_all" ON org_event_programs
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4) org_event_trails — 행사 <-> 숲길 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_event_trails (
  event_id   uuid NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  trail_id   uuid NOT NULL REFERENCES partner_trails(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, trail_id)
);

CREATE INDEX IF NOT EXISTS idx_org_event_trails_trail
  ON org_event_trails (trail_id);

ALTER TABLE org_event_trails ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): gate writes on the parent org_event's org membership.
DROP POLICY IF EXISTS "org_event_trails_all" ON org_event_trails;
CREATE POLICY "org_event_trails_all" ON org_event_trails
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5) org_event_participants — 행사 <-> 참가자 (M:N)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_event_participants (
  event_id  uuid NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  user_id   uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_org_event_p_user
  ON org_event_participants (user_id);

ALTER TABLE org_event_participants ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT by org admin OR by auth user == user_id when org_event
-- is LIVE and self-join policy is enabled; DELETE by org admin or self.
DROP POLICY IF EXISTS "org_event_participants_all" ON org_event_participants;
CREATE POLICY "org_event_participants_all" ON org_event_participants
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6) tori_fm_sessions.event_id — 1:N (FM session belongs to at most one event)
-- ---------------------------------------------------------------------------
ALTER TABLE tori_fm_sessions
  ADD COLUMN IF NOT EXISTS event_id uuid NULL
    REFERENCES org_events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tori_fm_sessions_event
  ON tori_fm_sessions (event_id);

-- ---------------------------------------------------------------------------
-- Realtime publication (exception-safe) — useful for LIVE status changes
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE org_events;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE org_event_participants;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Aggregate view: per-event resource counts
-- ---------------------------------------------------------------------------
CREATE OR REPLACE VIEW view_org_event_summary AS
SELECT
  e.id          AS event_id,
  e.org_id,
  e.name,
  e.status,
  e.starts_at,
  e.ends_at,
  (SELECT count(*)::int FROM org_event_quest_packs  WHERE event_id = e.id) AS quest_pack_count,
  (SELECT count(*)::int FROM org_event_participants WHERE event_id = e.id) AS participant_count,
  (SELECT count(*)::int FROM tori_fm_sessions       WHERE event_id = e.id) AS fm_session_count,
  (SELECT count(*)::int FROM org_event_programs     WHERE event_id = e.id) AS program_count,
  (SELECT count(*)::int FROM org_event_trails       WHERE event_id = e.id) AS trail_count
FROM org_events e;

-- ============================================================================
-- End of migration 20260523000000_org_events.sql
-- ============================================================================
