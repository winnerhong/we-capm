CREATE TABLE IF NOT EXISTS event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_phone text NOT NULL,
  participant_name text,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  mission_highlight text,
  improvement text,
  photo_consent boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, participant_phone)
);
CREATE INDEX IF NOT EXISTS idx_reviews_event ON event_reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON event_reviews(rating);
ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_reviews_all" ON event_reviews;
CREATE POLICY "event_reviews_all" ON event_reviews FOR ALL USING (true) WITH CHECK (true);
