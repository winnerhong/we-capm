-- ============================================================
-- 숲길 난이도 자유 생성/수정/삭제
-- 기존 EASY/MEDIUM/HARD CHECK 해제 + 파트너별 커스텀 난이도 테이블
-- ============================================================

ALTER TABLE partner_trails DROP CONSTRAINT IF EXISTS partner_trails_difficulty_check;
ALTER TABLE partner_trails ADD CONSTRAINT partner_trails_difficulty_check
  CHECK (char_length(difficulty) BETWEEN 1 AND 40);

CREATE TABLE IF NOT EXISTS partner_trail_difficulties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  key text NOT NULL,
  label text NOT NULL,
  icon text DEFAULT '🌿',
  description text,
  display_order int NOT NULL DEFAULT 999,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, key)
);

CREATE INDEX IF NOT EXISTS idx_trail_difficulties_partner ON partner_trail_difficulties(partner_id);

ALTER TABLE partner_trail_difficulties ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_trail_difficulties_all" ON partner_trail_difficulties;
CREATE POLICY "partner_trail_difficulties_all" ON partner_trail_difficulties
  FOR ALL USING (true) WITH CHECK (true);
