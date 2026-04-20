-- =====================================================
-- Partner Programs Catalog
-- Experience programs that partners (숲지기) sell
-- to schools (B2B) and individuals (B2C)
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('FOREST','CAMPING','KIDS','FAMILY','TEAM','ART')),
  duration_hours numeric,
  capacity_min int DEFAULT 5,
  capacity_max int DEFAULT 30,
  price_per_person int NOT NULL,
  b2b_price_per_person int,
  location_region text,
  location_detail text,
  image_url text,
  tags text[],
  rating_avg numeric,
  rating_count int NOT NULL DEFAULT 0,
  booking_count int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_programs_partner ON partner_programs(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_programs_published ON partner_programs(is_published);

ALTER TABLE partner_programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_programs_all" ON partner_programs;
CREATE POLICY "partner_programs_all" ON partner_programs FOR ALL USING (true) WITH CHECK (true);
