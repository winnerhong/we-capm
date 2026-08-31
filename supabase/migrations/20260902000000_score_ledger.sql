-- ============================================================================
-- Migration: 20260902000000_score_ledger.sql
-- Purpose : 등수용 **점수 원장**을 도토리 지갑에서 분리한다 + 미션 소요 시간 기록
--
-- ## 무엇이 문제였나
--   등수를 도토리 합계로 매겼다. 그런데 미션마다 acorns 가 고정(0~20 정수)이라
--   미션 10개짜리 행사의 만점은 **정확히 한 값**이다. 다 한 집은 전부 동점이 된다.
--   정수 상수만 더하는 한 동점은 필연이다.
--
-- ## 왜 도토리를 직접 깎지 않는가
--   도토리는 쓰는 재화다 — 원장에 SPEND_COUPON · SPEND_DECORATION 이 있고
--   app_users.acorn_balance 가 실제로 줄어든다. 「대충 내서 반려당하면 깎인다」를
--   도토리로 구현하면, 이미 써버린 집에서는 잔액이 음수가 된다. 지금 코드는
--   Math.max(0, …) 로 막고 있어서 **원장과 잔액이 조용히 어긋난다.**
--   쓴 것은 되물릴 수 없다.
--
--   그래서 나눈다:
--     도토리 = 지갑. 늘기만 한다(오승인 회수는 예외).  → user_acorn_transactions
--     점수   = 등수. 깎일 수 있고 아무것도 살 수 없다. → user_score_events (신규)
--
-- ## 동점을 없애는 것은 「초」다
--   점수 = 도토리×100 + 속도 보너스(0~50%) − 반려 감점(25%/회)
--   속도 보너스는 소요 시간(초)에서 나오는 **연속량**이라 1초만 달라도 갈린다.
--   계산식은 src/lib/scoring/core.ts 에 있고 테스트로 못 박혀 있다.
--
-- 멱등 (IF NOT EXISTS) — 재실행 안전
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) mission_submissions.elapsed_seconds — 제출 시점 스냅샷
-- ---------------------------------------------------------------------------
--   mission_attempts.opened_at 에서 계산하지만, 그 행은 미션 페이지에 다시
--   들어올 때마다 opened_at 이 덮이고(UNIQUE(user_id, org_mission_id) upsert)
--   행사가 끝나면 지워질 수도 있다. 나중에 다시 계산할 수 없으므로 **제출하는
--   순간 박아 둔다.** 점수를 재계산해야 할 일이 생겨도 근거가 남는다.
ALTER TABLE mission_submissions
  ADD COLUMN IF NOT EXISTS elapsed_seconds int;

COMMENT ON COLUMN mission_submissions.elapsed_seconds IS
  '미션 페이지 입장(mission_attempts.opened_at)부터 제출까지 초. 못 쟀으면 NULL — 그 경우 속도 보너스 없이 기본점만.';

-- ---------------------------------------------------------------------------
-- 2) user_score_events — 등수 원장
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_score_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  org_id      uuid REFERENCES partner_orgs(id) ON DELETE SET NULL,
  -- 행사 단위로 줄을 세운다. 두 기관에 다니는 집이 양쪽 점수를 합쳐 유리해지면
  -- 안 되기 때문이다(도토리 랭킹이 같은 이유로 event_id 기준으로 바뀌었다).
  event_id    uuid REFERENCES org_events(id) ON DELETE SET NULL,
  org_mission_id uuid REFERENCES org_missions(id) ON DELETE SET NULL,
  submission_id  uuid REFERENCES mission_submissions(id) ON DELETE CASCADE,

  -- MISSION_APPROVED : 승인 (기본점 + 속도 보너스, 양수)
  -- MISSION_REJECTED : 반려 (감점, 음수)
  -- MISSION_REVOKED  : 오승인 취소 (승인분 되돌림, 음수)
  -- ADMIN_ADJUST     : 운영자 수동 조정
  kind        text NOT NULL,

  points      int NOT NULL,
  -- 근거를 남긴다. {base, speedBonus, elapsedSeconds, par} 등.
  -- 나중에 "왜 이 집이 3등인가"를 설명할 수 있어야 한다.
  detail_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  memo        text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- 같은 제출에 같은 종류의 점수가 두 번 들어가지 않게. 승인은 재시도·중복 호출이
-- 잦은 경로라(자동 승인 크론 + 수동 승인) 멱등이 아니면 점수가 불어난다.
--   ⚠ 반려는 여러 번 날 수 있지만 **재제출하면 submission 이 새로 생긴다.**
--     같은 submission 을 두 번 반려하는 것은 중복이 맞다.
CREATE UNIQUE INDEX IF NOT EXISTS uq_score_events_submission_kind
  ON user_score_events(submission_id, kind)
  WHERE submission_id IS NOT NULL;

-- 행사 랭킹: event_id 로 모아 user_id 별 합산
CREATE INDEX IF NOT EXISTS idx_score_events_event_user
  ON user_score_events(event_id, user_id);

-- 개인 점수 내역 화면
CREATE INDEX IF NOT EXISTS idx_score_events_user_created
  ON user_score_events(user_id, created_at DESC);

-- 기관 관제
CREATE INDEX IF NOT EXISTS idx_score_events_org_created
  ON user_score_events(org_id, created_at DESC);

COMMENT ON TABLE user_score_events IS
  '등수 전용 점수 원장. 도토리 지갑(user_acorn_transactions)과 분리 — 점수는 깎일 수 있고 아무것도 살 수 없다.';

-- RLS: 기존 Phase 0 패턴(서버 액션 레이어에서 권한 검증)
ALTER TABLE user_score_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_score_events_all" ON user_score_events;
CREATE POLICY "user_score_events_all" ON user_score_events
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) event_score_ranking(event_id) — 행사 랭킹 한 방
-- ---------------------------------------------------------------------------
--   동점 처리: 점수가 같으면 **먼저 그 점수에 도달한 집**이 앞이다.
--   (마지막 점수 획득 시각이 이른 쪽. 늦게 따라잡은 집이 앞설 이유가 없다.)
--   등수 자체는 함수가 매기지 않는다. 정렬만 확정해 주고 몇 위인지는 부르는 쪽이
--   배열 순서로 센다. RANK() 출력 컬럼을 두면 이름이 SQL 함수의 OUT 파라미터와
--   겹칠 여지가 있는데, 여기서 그 위험을 감수할 이유가 없다(쓰는 곳도 없다).
CREATE OR REPLACE FUNCTION event_score_ranking(p_event_id uuid)
RETURNS TABLE (
  user_id        uuid,
  total_points   bigint,
  last_scored_at timestamptz
)
LANGUAGE sql
STABLE
AS $$
  SELECT s.user_id,
         SUM(s.points)::bigint AS total_points,
         MAX(s.created_at)     AS last_scored_at
  FROM user_score_events s
  WHERE s.event_id = p_event_id
  GROUP BY s.user_id
  HAVING SUM(s.points) > 0
  ORDER BY SUM(s.points) DESC, MAX(s.created_at) ASC
$$;

COMMENT ON FUNCTION event_score_ranking(uuid) IS
  '행사 하나의 점수 랭킹. 동점이면 먼저 도달한 집이 앞.';

NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 확인용
-- ---------------------------------------------------------------------------
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'mission_submissions'
  AND column_name = 'elapsed_seconds';

SELECT count(*) AS score_events FROM user_score_events;
