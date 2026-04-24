-- ============================================================================
-- Migration: 20260519000000_tori_fm_interactive.sql
-- Purpose : Tori FM interactive layer — chat / reactions / hearts / polls
--           (requests, chat messages, reactions, hearts, polls, poll_votes)
-- Depends : tori_fm_sessions, app_users, mission_radio_queue
-- Notes   : Fully idempotent. Phase 0 permissive RLS (TODO: tighten later).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) tori_fm_chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tori_fm_chat_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid NOT NULL REFERENCES tori_fm_sessions(id) ON DELETE CASCADE,
  user_id     uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
  sender_type text NOT NULL CHECK (sender_type IN ('USER','DJ','SYSTEM')),
  sender_name text NOT NULL,
  message     text NOT NULL CHECK (char_length(message) > 0 AND char_length(message) <= 300),
  is_deleted  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_chat_session_time
  ON tori_fm_chat_messages (session_id, created_at DESC);

ALTER TABLE tori_fm_chat_messages ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): restrict INSERT to authenticated app_user matching user_id;
-- allow DELETE only for session DJ or admin; restrict SYSTEM/DJ sender_type.
DROP POLICY IF EXISTS "fm_chat_all" ON tori_fm_chat_messages;
CREATE POLICY "fm_chat_all" ON tori_fm_chat_messages
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) tori_fm_requests
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tori_fm_requests (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id       uuid NOT NULL REFERENCES tori_fm_sessions(id) ON DELETE CASCADE,
  user_id          uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  song_title       text NOT NULL,
  artist           text NULL,
  story            text NULL,
  child_name       text NULL,
  song_normalized  text GENERATED ALWAYS AS (
                     lower(trim(song_title || ' ' || coalesce(artist,'')))
                   ) STORED,
  heart_count      int  NOT NULL DEFAULT 0,
  status           text NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','APPROVED','PLAYED','HIDDEN')),
  queue_id         uuid NULL REFERENCES mission_radio_queue(id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_req_session
  ON tori_fm_requests (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fm_req_song_norm
  ON tori_fm_requests (session_id, song_normalized);
CREATE INDEX IF NOT EXISTS idx_fm_req_user
  ON tori_fm_requests (user_id);
CREATE INDEX IF NOT EXISTS idx_fm_req_pending
  ON tori_fm_requests (status) WHERE status = 'PENDING';

ALTER TABLE tori_fm_requests ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT only when auth.uid() maps to user_id; UPDATE status
-- restricted to DJ/admin; HIDDEN rows visible only to staff.
DROP POLICY IF EXISTS "fm_requests_all" ON tori_fm_requests;
CREATE POLICY "fm_requests_all" ON tori_fm_requests
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) tori_fm_polls
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tori_fm_polls (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES tori_fm_sessions(id) ON DELETE CASCADE,
  question          text NOT NULL CHECK (char_length(question) > 0 AND char_length(question) <= 200),
  options           jsonb NOT NULL,
  duration_sec      int  NOT NULL DEFAULT 60 CHECK (duration_sec BETWEEN 15 AND 600),
  starts_at         timestamptz NOT NULL DEFAULT now(),
  ends_at           timestamptz NOT NULL,
  status            text NOT NULL DEFAULT 'ACTIVE'
                      CHECK (status IN ('ACTIVE','ENDED','CANCELLED')),
  winner_option_id  text NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_polls_session_status
  ON tori_fm_polls (session_id, status);

ALTER TABLE tori_fm_polls ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT/UPDATE/DELETE restricted to session DJ or admin.
DROP POLICY IF EXISTS "fm_polls_all" ON tori_fm_polls;
CREATE POLICY "fm_polls_all" ON tori_fm_polls
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4) tori_fm_poll_votes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tori_fm_poll_votes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     uuid NOT NULL REFERENCES tori_fm_polls(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  option_id   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (poll_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_fm_poll_votes_poll
  ON tori_fm_poll_votes (poll_id);

ALTER TABLE tori_fm_poll_votes ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT only for auth.uid() == user_id and while poll.status='ACTIVE'
-- and now() < poll.ends_at. No UPDATE/DELETE by users.
DROP POLICY IF EXISTS "fm_poll_votes_all" ON tori_fm_poll_votes;
CREATE POLICY "fm_poll_votes_all" ON tori_fm_poll_votes
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 5) tori_fm_reactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tori_fm_reactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         uuid NOT NULL REFERENCES tori_fm_sessions(id) ON DELETE CASCADE,
  user_id            uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
  emoji              text NOT NULL CHECK (emoji IN ('❤','👏','🎉','🌲','🌰','😂')),
  target_request_id  uuid NULL REFERENCES tori_fm_requests(id) ON DELETE CASCADE,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_reactions_session_time
  ON tori_fm_reactions (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fm_reactions_target
  ON tori_fm_reactions (target_request_id)
  WHERE target_request_id IS NOT NULL;

ALTER TABLE tori_fm_reactions ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): rate-limit via server function; optionally require auth when
-- user_id IS NOT NULL; allow anon inserts only if session.allow_anon_reactions.
DROP POLICY IF EXISTS "fm_reactions_all" ON tori_fm_reactions;
CREATE POLICY "fm_reactions_all" ON tori_fm_reactions
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 6) tori_fm_request_hearts
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tori_fm_request_hearts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  uuid NOT NULL REFERENCES tori_fm_requests(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

ALTER TABLE tori_fm_request_hearts ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): INSERT only when auth.uid() == user_id; DELETE only own row.
DROP POLICY IF EXISTS "fm_request_hearts_all" ON tori_fm_request_hearts;
CREATE POLICY "fm_request_hearts_all" ON tori_fm_request_hearts
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Trigger: keep tori_fm_requests.heart_count in sync with hearts table
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION sync_request_heart_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE tori_fm_requests
       SET heart_count = heart_count + 1
     WHERE id = NEW.request_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE tori_fm_requests
       SET heart_count = GREATEST(0, heart_count - 1)
     WHERE id = OLD.request_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_request_heart_count ON tori_fm_request_hearts;
CREATE TRIGGER trg_sync_request_heart_count
  AFTER INSERT OR DELETE ON tori_fm_request_hearts
  FOR EACH ROW EXECUTE FUNCTION sync_request_heart_count();

-- ---------------------------------------------------------------------------
-- Realtime publication (exception-safe)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tori_fm_chat_messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tori_fm_requests;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tori_fm_polls;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tori_fm_poll_votes;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tori_fm_reactions;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tori_fm_request_hearts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- Aggregate views
-- ---------------------------------------------------------------------------

-- 1) Top songs today (per session)
CREATE OR REPLACE VIEW view_fm_top_songs_today AS
SELECT
  session_id,
  song_title,
  coalesce(artist, '(가수 미입력)') AS artist,
  count(*)::int                   AS request_count,
  coalesce(sum(heart_count), 0)::int AS total_hearts
FROM tori_fm_requests
WHERE created_at >= date_trunc('day', now())
  AND status != 'HIDDEN'
GROUP BY session_id, song_title, artist
ORDER BY request_count DESC, total_hearts DESC;

-- 2) Top artists today (per session)
CREATE OR REPLACE VIEW view_fm_top_artists_today AS
SELECT
  session_id,
  coalesce(artist, '(미지정)') AS artist,
  count(*)::int                AS request_count,
  coalesce(sum(heart_count), 0)::int AS total_hearts
FROM tori_fm_requests
WHERE created_at >= date_trunc('day', now())
  AND status != 'HIDDEN'
  AND artist IS NOT NULL
GROUP BY session_id, artist
ORDER BY request_count DESC;

-- 3) Top stories today (by heart_count)
CREATE OR REPLACE VIEW view_fm_top_stories_today AS
SELECT
  r.id         AS request_id,
  r.session_id,
  r.user_id,
  r.song_title,
  r.artist,
  r.story,
  r.child_name,
  r.heart_count,
  au.parent_name
FROM tori_fm_requests r
LEFT JOIN app_users au ON au.id = r.user_id
WHERE r.created_at >= date_trunc('day', now())
  AND r.status != 'HIDDEN'
  AND r.story IS NOT NULL
ORDER BY r.heart_count DESC;

-- 4) Top families today
CREATE OR REPLACE VIEW view_fm_top_families_today AS
SELECT
  r.session_id,
  r.user_id,
  au.parent_name,
  count(r.*)::int                    AS request_count,
  coalesce(sum(r.heart_count), 0)::int AS total_hearts
FROM tori_fm_requests r
LEFT JOIN app_users au ON au.id = r.user_id
WHERE r.created_at >= date_trunc('day', now())
  AND r.status != 'HIDDEN'
GROUP BY r.session_id, r.user_id, au.parent_name
ORDER BY total_hearts DESC, request_count DESC;

-- 5) Top chatters today
CREATE OR REPLACE VIEW view_fm_top_chatters_today AS
SELECT
  m.session_id,
  m.user_id,
  m.sender_name,
  count(*)::int AS message_count
FROM tori_fm_chat_messages m
WHERE m.created_at >= date_trunc('day', now())
  AND m.is_deleted = false
  AND m.sender_type = 'USER'
GROUP BY m.session_id, m.user_id, m.sender_name
ORDER BY message_count DESC;

-- ============================================================================
-- End of migration 20260519000000_tori_fm_interactive.sql
-- ============================================================================
