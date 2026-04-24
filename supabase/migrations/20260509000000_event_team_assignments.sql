-- =====================================================
-- Event Team Assignments (Phase 1 MVP)
-- 행사별 팀장/부팀장/지원 팀원 배정
-- =====================================================

CREATE TABLE IF NOT EXISTS event_team_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES partner_team_members(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'ASSISTANT'
    CHECK (role IN ('LEADER','ASSISTANT','SUPPORT')),
  memo text,
  assigned_by uuid,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, team_member_id)
);

-- 한 행사에 LEADER 1명만
CREATE UNIQUE INDEX IF NOT EXISTS one_leader_per_event
  ON event_team_assignments(event_id)
  WHERE role = 'LEADER';

CREATE INDEX IF NOT EXISTS idx_event_team_event ON event_team_assignments(event_id);
CREATE INDEX IF NOT EXISTS idx_event_team_member ON event_team_assignments(team_member_id);

ALTER TABLE event_team_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_team_assignments_all" ON event_team_assignments;
CREATE POLICY "event_team_assignments_all" ON event_team_assignments
  FOR ALL USING (true) WITH CHECK (true);
