-- =====================================================
-- 선물·참가 아동을 행사 단위로
--
-- 1) user_gifts.event_id
--      선물함은 행사 안에서 열린다. 다른 행사에서 받은 선물이 섞이면 안 된다.
--      기존 행은 org_id + 지급 시각으로 가장 그럴듯한 행사에 귀속.
--
-- 2) org_event_participant_children
--      app_children 은 계정 단위(사람)라 "우리 아이 4명"이 어느 기관 화면에서든
--      그대로 떴다. 실제로는 행사마다 참가하는 아이가 다르다.
--      행사 ↔ 아동 연결을 별도 테이블로 둔다.
--      비어 있으면 화면은 계정 전체 자녀로 fallback 한다(기존 동작 유지).
--
-- 재실행 안전.
-- =====================================================

-- ── 1) 선물 ────────────────────────────────────────────
ALTER TABLE user_gifts
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES org_events(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_gifts.event_id IS
  '이 선물이 지급된 행사. 선물함은 행사 단위로 보여준다.';

CREATE INDEX IF NOT EXISTS idx_user_gifts_user_event
  ON user_gifts(user_id, event_id);

-- 백필 — 같은 기관 행사 중, 지급 시각을 품는 행사를 우선.
--   (기간이 안 맞으면 그 기관에서 그 보호자가 참가한 가장 최근 행사)
UPDATE user_gifts g
   SET event_id = pick.event_id
  FROM (
    SELECT DISTINCT ON (g2.id) g2.id AS gift_id, e.id AS event_id
      FROM user_gifts g2
      JOIN org_event_participants p ON p.user_id = g2.user_id
      JOIN org_events e             ON e.id = p.event_id AND e.org_id = g2.org_id
     ORDER BY
       g2.id,
       -- 지급 시각이 행사 기간 안이면 최우선
       (e.starts_at IS NOT NULL AND e.ends_at IS NOT NULL
        AND g2.granted_at BETWEEN e.starts_at AND e.ends_at) DESC,
       e.starts_at DESC NULLS LAST
  ) pick
 WHERE g.event_id IS NULL
   AND g.id = pick.gift_id;

-- ── 2) 행사별 참가 아동 ────────────────────────────────
CREATE TABLE IF NOT EXISTS org_event_participant_children (
  event_id   uuid NOT NULL REFERENCES org_events(id)   ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES app_users(id)    ON DELETE CASCADE,
  child_id   uuid NOT NULL REFERENCES app_children(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, child_id)
);

COMMENT ON TABLE org_event_participant_children IS
  '행사에 실제로 참가하는 아동. 비어 있으면 화면은 보호자의 전체 자녀로 fallback.';

CREATE INDEX IF NOT EXISTS idx_oepc_event_user
  ON org_event_participant_children(event_id, user_id);

ALTER TABLE org_event_participant_children ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "oepc_all" ON org_event_participant_children;
CREATE POLICY "oepc_all" ON org_event_participant_children
  FOR ALL USING (true) WITH CHECK (true);

-- 백필 — 원생(is_enrolled) 자녀를, 그 보호자가 참가한 "홈 기관" 행사에 연결.
--   타 기관 행사(초대장으로 참가)에는 연결하지 않는다. 그 행사에 누가 가는지는
--   기관이 명단으로 정하거나 보호자가 고르는 것이지, 추측할 일이 아니다.
INSERT INTO org_event_participant_children (event_id, user_id, child_id)
SELECT p.event_id, p.user_id, c.id
  FROM org_event_participants p
  JOIN org_events e  ON e.id = p.event_id
  JOIN app_users  u  ON u.id = p.user_id AND u.org_id = e.org_id
  JOIN app_children c ON c.user_id = p.user_id AND c.is_enrolled = true
ON CONFLICT (event_id, child_id) DO NOTHING;

DO $$
DECLARE n int; g int;
BEGIN
  SELECT COUNT(*) INTO n FROM org_event_participant_children;
  SELECT COUNT(*) INTO g FROM user_gifts WHERE event_id IS NULL;
  RAISE NOTICE '행사별 참가 아동 % 건 연결', n;
  RAISE NOTICE '행사 미귀속 선물 % 건 (그 기관 참가 이력이 없는 건)', g;
END $$;

NOTIFY pgrst, 'reload schema';
