-- =====================================================
-- 도토리를 행사 단위로 — user_acorn_transactions.event_id
--
-- "해당 행사는 해당 행사로 끝." 참좋은어린이집 행사에서 모은 도토리가
-- 도원센트럴어린이집 행사 화면에 뜨면 안 된다.
--
-- ⚠ 선행 필수: 20260818000000_acorn_ledger_reconcile.sql
--    원장에 없는 도토리는 어느 행사에 귀속시킬지 판단할 근거가 없다.
--    아래 가드에서 확인하고, 미적용이면 이 마이그레이션은 중단된다.
--
-- 귀속 경로 (전량 추적 가능):
--   mission_submission → org_missions → org_quest_packs
--                      → org_event_quest_packs → org_events
--   fm_request         → tori_fm_requests → tori_fm_sessions.event_id
--   그 외(보정행 등)   → 그 보호자가 가장 먼저 참가한 행사
--
-- app_users.acorn_balance 는 삭제하지 않는다.
--   "전체 누적(참고용)" 으로 남기고, 화면은 행사별 집계를 쓴다.
--
-- 재실행 안전.
-- =====================================================

-- 0) 가드 — 원장 정합성이 먼저다.
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
    FROM app_users u
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total
        FROM user_acorn_transactions GROUP BY user_id
    ) t ON t.user_id = u.id
   WHERE u.acorn_balance <> COALESCE(t.total, 0);
  IF n > 0 THEN
    RAISE EXCEPTION
      '중단: 잔액≠원장인 보호자가 % 명. 20260818000000_acorn_ledger_reconcile.sql 을 먼저 실행하세요.', n;
  END IF;
END $$;

-- 1) 컬럼
ALTER TABLE user_acorn_transactions
  ADD COLUMN IF NOT EXISTS event_id uuid REFERENCES org_events(id) ON DELETE SET NULL;

COMMENT ON COLUMN user_acorn_transactions.event_id IS
  '이 도토리가 오간 행사. 참가자 화면의 도토리·랭킹은 전부 이 값으로 집계한다.';

CREATE INDEX IF NOT EXISTS idx_user_acorn_tx_user_event
  ON user_acorn_transactions(user_id, event_id);
CREATE INDEX IF NOT EXISTS idx_user_acorn_tx_event
  ON user_acorn_transactions(event_id);

-- 2) 미션 제출분 귀속
UPDATE user_acorn_transactions t
   SET event_id = sub.event_id
  FROM (
    SELECT ms.id AS submission_id, eqp.event_id
      FROM mission_submissions ms
      JOIN org_missions om          ON om.id  = ms.org_mission_id
      JOIN org_event_quest_packs eqp ON eqp.quest_pack_id = om.quest_pack_id
  ) sub
 WHERE t.event_id IS NULL
   AND t.source_type IN ('mission_submission', 'mission_submission_reverse')
   AND t.source_id = sub.submission_id;

-- 3) 토리FM 분 귀속
UPDATE user_acorn_transactions t
   SET event_id = s.event_id
  FROM tori_fm_requests r
  JOIN tori_fm_sessions s ON s.id = r.session_id
 WHERE t.event_id IS NULL
   AND t.source_type = 'fm_request'
   AND t.source_id = r.id
   AND s.event_id IS NOT NULL;

-- 4) 나머지(보정행·행사 미연결 스탬프북 등) → 그 보호자가 가장 먼저 참가한 행사
UPDATE user_acorn_transactions t
   SET event_id = first_ev.event_id
  FROM (
    SELECT DISTINCT ON (p.user_id) p.user_id, p.event_id
      FROM org_event_participants p
     ORDER BY p.user_id, p.joined_at ASC
  ) first_ev
 WHERE t.event_id IS NULL
   AND t.user_id = first_ev.user_id;

-- 5) 현황 로그 — 남은 미귀속은 참가 행사가 아예 없는 보호자의 것.
DO $$
DECLARE
  total int; unassigned int; packs_unlinked int;
BEGIN
  SELECT COUNT(*) INTO total FROM user_acorn_transactions;
  SELECT COUNT(*) INTO unassigned FROM user_acorn_transactions WHERE event_id IS NULL;
  SELECT COUNT(*) INTO packs_unlinked
    FROM org_quest_packs qp
   WHERE NOT EXISTS (
     SELECT 1 FROM org_event_quest_packs e WHERE e.quest_pack_id = qp.id
   );
  RAISE NOTICE '원장 % 건 중 미귀속 % 건', total, unassigned;
  IF packs_unlinked > 0 THEN
    RAISE NOTICE '⚠ 행사에 연결되지 않은 스탬프북 % 개 — 관제실에서 행사에 연결하면 정확도가 올라갑니다', packs_unlinked;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
