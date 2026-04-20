-- =====================================================
-- B2B Enterprise Inquiries
-- Corporate team-building / ESG event inquiries
-- from the public /enterprise landing page
-- =====================================================

CREATE TABLE IF NOT EXISTS b2b_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  expected_attendees text,
  interested_packages text[],
  preferred_date timestamptz,
  message text,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','CONTACTED','PROPOSED','WON','LOST')),
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_b2b_inquiries_status ON b2b_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_b2b_inquiries_created ON b2b_inquiries(created_at DESC);

ALTER TABLE b2b_inquiries ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "b2b_inquiries_all" ON b2b_inquiries;
CREATE POLICY "b2b_inquiries_all" ON b2b_inquiries FOR ALL USING (true) WITH CHECK (true);
