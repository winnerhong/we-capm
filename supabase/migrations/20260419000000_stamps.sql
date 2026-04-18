-- ============================================================
-- Stamp Rally tables: boards, slots, records, albums
-- ============================================================

-- stamp_boards
CREATE TABLE IF NOT EXISTS stamp_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  total_slots int NOT NULL CHECK (total_slots > 0 AND total_slots <= 12),
  tier_config jsonb NOT NULL DEFAULT '{"sprout":{"label":"\uc0c8\uc2f9","emoji":"\ud83c\udf31","goal_count":3,"reward_id":null},"explorer":{"label":"\ud0d0\ud5d8\uac00","emoji":"\ud83c\udf3f","goal_count":5,"reward_id":null},"keeper":{"label":"\uc232\uc9c0\ud0b4\uc774","emoji":"\ud83c\udf33","goal_count":8,"reward_id":null}}',
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stamp_boards_event ON stamp_boards(event_id);

-- stamp_slots
CREATE TABLE IF NOT EXISTS stamp_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES stamp_boards(id) ON DELETE CASCADE,
  "order" int NOT NULL DEFAULT 0,
  name text NOT NULL,
  icon text DEFAULT '📍',
  description text,
  location_hint text,
  type text NOT NULL DEFAULT 'MANUAL' CHECK (type IN ('MANUAL','AUTO_MISSION','AUTO_ENTRY')),
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  congestion_status text NOT NULL DEFAULT 'GREEN' CHECK (congestion_status IN ('GREEN','YELLOW','RED')),
  staff_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, "order")
);
CREATE INDEX IF NOT EXISTS idx_stamp_slots_board ON stamp_slots(board_id);
CREATE INDEX IF NOT EXISTS idx_stamp_slots_mission ON stamp_slots(mission_id);

-- stamp_records
CREATE TABLE IF NOT EXISTS stamp_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES stamp_slots(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  stamped_by text,
  photo_url text,
  stamped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slot_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_stamp_records_slot ON stamp_records(slot_id);
CREATE INDEX IF NOT EXISTS idx_stamp_records_participant ON stamp_records(participant_id);

-- stamp_albums
CREATE TABLE IF NOT EXISTS stamp_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES stamp_slots(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stamp_albums_participant ON stamp_albums(participant_id);

-- RLS
ALTER TABLE stamp_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stamp_boards_all" ON stamp_boards;
CREATE POLICY "stamp_boards_all" ON stamp_boards FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stamp_slots_all" ON stamp_slots;
CREATE POLICY "stamp_slots_all" ON stamp_slots FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stamp_records_all" ON stamp_records;
CREATE POLICY "stamp_records_all" ON stamp_records FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "stamp_albums_all" ON stamp_albums;
CREATE POLICY "stamp_albums_all" ON stamp_albums FOR ALL USING (true) WITH CHECK (true);

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE stamp_records;
ALTER PUBLICATION supabase_realtime ADD TABLE stamp_slots;
