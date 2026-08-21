-- =====================================================================
-- 행사 격리 마이그레이션 — 한 번에 실행용 (순서 고정)
--
-- Supabase SQL Editor 에 통째로 붙여넣고 실행하세요.
-- 네 파일을 순서대로 이어붙인 것이며, 전부 재실행 안전(idempotent)입니다.
--
-- 안전장치:
--   · 도토리 잔액은 한 개도 줄지 않습니다 (원장을 잔액에 맞춰 올립니다)
--   · 2/4 는 1/4 가 안 돌았으면 스스로 중단합니다
--   · 4/4 후에도 관제 명단 인원은 그대로입니다 (참가 기록이 커버)
--
-- 실행 후 NOTICE 로 각 단계 결과가 출력됩니다. 확인 포인트:
--   "✔ 잔액 = 원장 합계 (전원 일치)"
--   "원장 N 건 중 미귀속 M 건"   ← M 이 크면 스탬프북-행사 연결을 확인
--   "행사별 참가 아동 N 건 연결"
--   "소속 없이 행사만 참가한 보호자 N 명"
-- =====================================================================


-- ╔═══════════════════════════════════════════════════════════════════
-- ║ 1/4  도토리 원장 정합성 복구 (79명 — 잔액은 줄지 않음)
-- ║ 20260818000000_acorn_ledger_reconcile.sql
-- ╚═══════════════════════════════════════════════════════════════════

-- =====================================================
-- 도토리 원장 정합성 복구 — 잔액과 원장 합계를 일치시킨다.
--
-- 배경:
--   app_users.acorn_balance 는 지금까지 두 갈래로 갱신돼 왔다.
--     · 미션·FM  → user_acorn_transactions 기록 + 잔액 갱신  (정상)
--     · 온보딩 보상 / 형제 보너스 → 잔액만 갱신, 원장 없음   (누락)
--   그 결과 231명 중 79명의 잔액이 원장 합계와 어긋나 있다.
--   (예: 잔액 21, 원장 합계 -2 → 차이 23)
--
-- 왜 지금 고치나:
--   도토리를 행사 단위로 집계하려면 원장이 진실의 원천이어야 한다.
--   원장에 없는 도토리는 어느 행사에 귀속시킬지 판단할 근거가 없다.
--
-- 방침 — 잔액은 한 개도 줄이지 않는다:
--   원장을 잔액에 맞춰 올린다(반대 방향 X). 차액만큼 보정 행을 만든다.
--   잔액이 원장보다 "적은" 경우(환불·차감 누락)도 같은 방식으로 음수 보정.
--
-- 코드 쪽 누락은 같은 배포에서 수정됨:
--   src/app/(user)/profile/actions.ts — recordAcornGrant() 추가
--
-- 재실행 안전: 이미 보정된 유저는 차액이 0이라 다시 잡히지 않는다.
-- =====================================================

-- 1) 보정 전 현황 로그
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
    FROM app_users u
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total
        FROM user_acorn_transactions
       GROUP BY user_id
    ) t ON t.user_id = u.id
   WHERE u.acorn_balance <> COALESCE(t.total, 0);
  RAISE NOTICE '보정 대상: % 명', n;
END $$;

-- 2) 차액을 보정 행으로 기록
--    reason 은 자유 텍스트(CHECK 없음). 소급분임이 드러나도록 전용 값 사용.
INSERT INTO user_acorn_transactions (user_id, amount, reason, source_type, source_id, memo)
SELECT
  u.id,
  u.acorn_balance - COALESCE(t.total, 0),
  'LEDGER_RECONCILE',
  'ledger_reconcile',
  u.id,
  '원장 누락분 소급 기록 (온보딩 보상 등)'
FROM app_users u
LEFT JOIN (
  SELECT user_id, SUM(amount) AS total
    FROM user_acorn_transactions
   GROUP BY user_id
) t ON t.user_id = u.id
WHERE u.acorn_balance <> COALESCE(t.total, 0);

-- 3) 검증 — 남은 불일치가 있으면 실패시킨다.
--    (여기서 통과해야 다음 마이그레이션의 행사 귀속이 안전하다)
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
    FROM app_users u
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total
        FROM user_acorn_transactions
       GROUP BY user_id
    ) t ON t.user_id = u.id
   WHERE u.acorn_balance <> COALESCE(t.total, 0);
  IF n > 0 THEN
    RAISE EXCEPTION '원장 보정 실패 — 여전히 % 명 불일치', n;
  END IF;
  RAISE NOTICE '✔ 잔액 = 원장 합계 (전원 일치)';
END $$;

NOTIFY pgrst, 'reload schema';

-- ╔═══════════════════════════════════════════════════════════════════
-- ║ 2/4  도토리를 행사 단위로 (1/4 미실행 시 스스로 중단)
-- ║ 20260819000000_acorn_event_scope.sql
-- ╚═══════════════════════════════════════════════════════════════════

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

-- ╔═══════════════════════════════════════════════════════════════════
-- ║ 3/4  선물·참가 아동을 행사 단위로
-- ║ 20260820000000_gifts_children_event_scope.sql
-- ╚═══════════════════════════════════════════════════════════════════

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

-- ╔═══════════════════════════════════════════════════════════════════
-- ║ 4/4  소속 ≠ 참가 (초대장 참가로 생긴 소속 정리)
-- ║ 20260821000000_membership_vs_participation.sql
-- ╚═══════════════════════════════════════════════════════════════════

-- =====================================================
-- 소속(membership) 과 참가(participation) 분리
--
-- 문제:
--   초대장으로 행사 하나에 참가한 것만으로 app_user_orgs 행이 생겨,
--   등록한 적도 없는 기관이 그 보호자의 "내 기관"이 됐다.
--   ("도원센트럴은 셋팅도 안 했고 연락처를 입력하지도 않았는데")
--
-- 정리:
--   소속 = 기관이 명단에 올린 사람만
--            bulk_import / admin / self_register / backfill
--   참가 = org_event_participants (그 행사 접근권만)
--
--   → source='invitation' 행 제거.
--
-- 접근 권한은 줄어들지 않는다:
--   앱은 이제 hasOrgAccess(소속 ∪ 그 기관 행사 참가자) 로 판단하고,
--   행사 화면은 isEventParticipant 하나로 판단한다. 소속 행이 없어도
--   참가 기록이 있으면 그대로 들어갈 수 있다.
--
-- 관제 명단도 소속 ∪ 행사 참가자를 합쳐 보여주므로 아무도 사라지지 않는다.
--   (화면에서 '원생' / '행사 참가자' 배지로 구분)
--
-- 재실행 안전.
-- =====================================================

DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
    FROM app_user_orgs WHERE source = 'invitation';
  RAISE NOTICE '초대장 참가로 생겼던 소속 % 건 정리', n;
END $$;

DELETE FROM app_user_orgs WHERE source = 'invitation';

-- source 의 의미를 문서화 — 'invitation' 은 더 이상 쓰지 않는다.
COMMENT ON COLUMN app_user_orgs.source IS
  '소속이 생긴 경로: backfill / bulk_import / self_register / admin. '
  '(invitation 은 폐기 — 행사 참가는 소속이 아니다)';

-- 검증 — 소속이 사라진 보호자가 그 기관 행사 참가 기록은 유지하는지.
DO $$
DECLARE
  orphan int;
BEGIN
  SELECT COUNT(DISTINCT p.user_id) INTO orphan
    FROM org_event_participants p
    JOIN org_events e ON e.id = p.event_id
   WHERE NOT EXISTS (
     SELECT 1 FROM app_user_orgs m
      WHERE m.user_id = p.user_id AND m.org_id = e.org_id
   );
  RAISE NOTICE '소속 없이 행사만 참가한 보호자 % 명 — 명단에는 "행사 참가자" 로 표시됩니다', orphan;
END $$;

NOTIFY pgrst, 'reload schema';
