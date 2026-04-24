-- Partner Trails: 나만의 숲길 (QR·미션)
-- ============================================================
-- 파트너(캠핑장/숙소)가 자체 QR·미션 기반 트레일을 만들고,
-- 참가자가 QR을 스캔하며 완주하는 기능.
-- ============================================================

-- 1) partner_trails (숲길 템플릿)
CREATE TABLE IF NOT EXISTS partner_trails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  cover_image_url text,
  difficulty text NOT NULL DEFAULT 'EASY' CHECK (difficulty IN ('EASY','MEDIUM','HARD')),
  estimated_minutes int,
  distance_km numeric(4,2),
  total_slots int NOT NULL DEFAULT 0,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_public boolean NOT NULL DEFAULT false,
  slug text,
  view_count int NOT NULL DEFAULT 0,
  completion_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_partner_trails_partner ON partner_trails(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_trails_status ON partner_trails(status);

-- 2) partner_trail_stops (지점/POI)
CREATE TABLE IF NOT EXISTS partner_trail_stops (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES partner_trails(id) ON DELETE CASCADE,
  "order" int NOT NULL DEFAULT 0,
  name text NOT NULL,
  description text,
  location_hint text,
  lat double precision,
  lng double precision,
  photo_url text,
  qr_code text NOT NULL UNIQUE,
  mission_type text NOT NULL CHECK (mission_type IN ('PHOTO','QUIZ','LOCATION','CHECKIN')),
  mission_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  reward_points int NOT NULL DEFAULT 10,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(trail_id, "order")
);
CREATE INDEX IF NOT EXISTS idx_trail_stops_trail ON partner_trail_stops(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_stops_qr ON partner_trail_stops(qr_code);

-- 3) partner_trail_completions (완주 기록)
CREATE TABLE IF NOT EXISTS partner_trail_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trail_id uuid NOT NULL REFERENCES partner_trails(id) ON DELETE CASCADE,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  participant_phone text,
  participant_name text,
  stops_cleared text[] NOT NULL DEFAULT '{}',
  total_score int NOT NULL DEFAULT 0,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  certificate_url text
);
CREATE INDEX IF NOT EXISTS idx_trail_completions_trail ON partner_trail_completions(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_completions_phone ON partner_trail_completions(participant_phone);
CREATE INDEX IF NOT EXISTS idx_trail_completions_event ON partner_trail_completions(event_id);

-- RLS 활성화
ALTER TABLE partner_trails ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_trail_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_trail_completions ENABLE ROW LEVEL SECURITY;

-- 오픈 정책 (쿠키 기반 인증 / 실질 비활성)
DROP POLICY IF EXISTS "partner_trails_all" ON partner_trails;
CREATE POLICY "partner_trails_all" ON partner_trails FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_trail_stops_all" ON partner_trail_stops;
CREATE POLICY "partner_trail_stops_all" ON partner_trail_stops FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_trail_completions_all" ON partner_trail_completions;
CREATE POLICY "partner_trail_completions_all" ON partner_trail_completions FOR ALL USING (true) WITH CHECK (true);
