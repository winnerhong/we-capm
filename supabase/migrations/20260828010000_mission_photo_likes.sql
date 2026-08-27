-- =====================================================
-- 사진 좋아요 — 다른 가족 사진에 하트를 눌러 도토리를 보낸다
--
-- 규칙:
--   누르는 쪽 — 한 미션에서 3개까지, 사진 1장에 1개, 내 사진 제외, 취소 가능
--   받는 쪽   — 좋아요 1개당 도토리 +1, 단 한 사진당 최대 5개까지
--   도토리    — 원장(잔액)에만. mission_submissions.awarded_acorns 는 손대지 않는다.
--
-- awarded_acorns 를 건드리지 않는 이유:
--   스탬프북 진행도·최종보상 티어가 그 합계로 계산된다(sumAcornsForPack). 좋아요로
--   그 숫자가 오르면 기관이 정해둔 티어 문턱이 통째로 흔들리고, 미션 카드의
--   "+3 도토리 획득" 표시도 어긋난다. 좋아요 도토리는 선물함에서 쓰는 잔액이다.
--
-- "좋아요마다 도토리 1개" 가 아니라 **매번 다시 계산**하는 이유:
--   취소가 가능한데 상한이 있으면, 취소된 그 좋아요가 "도토리를 준 좋아요" 였는지
--   판정할 방법이 없다. 그래서 누를 때마다
--       받아야 할 도토리 = min(5, 좋아요 수)
--       차액 = 받아야 할 것 − 이미 준 것(원장 합계)
--   만 기록한다. 상한을 넘은 구간에서는 눌러도 취소해도 차액이 0이라 도토리가
--   움직이지 않는다.
--
-- 재실행 안전(idempotent).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) mission_photo_likes — 누가 어느 사진에 눌렀나
--
--    org_mission_id 를 제출물에서 조인해 오지 않고 복제해 두는 이유:
--    "이 미션에서 내가 몇 개 눌렀나" 를 누를 때마다 세야 한다. 조인 없이
--    (org_mission_id, from_user_id) 인덱스 하나로 끝나야 한다.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS mission_photo_likes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id  uuid NOT NULL REFERENCES mission_submissions(id) ON DELETE CASCADE,
  org_mission_id uuid NOT NULL REFERENCES org_missions(id) ON DELETE CASCADE,
  from_user_id   uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  event_id       uuid NULL REFERENCES org_events(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  -- 한 사진에 한 번. 연타·중복 요청은 여기서 막힌다.
  UNIQUE (submission_id, from_user_id)
);

CREATE INDEX IF NOT EXISTS idx_photo_likes_mission_user
  ON mission_photo_likes (org_mission_id, from_user_id);
CREATE INDEX IF NOT EXISTS idx_photo_likes_submission
  ON mission_photo_likes (submission_id);

-- TODO(phase1): INSERT/DELETE 를 auth.uid() = from_user_id 로 조인다.
-- 지금은 참가자에게 Supabase Auth 세션이 없어 서버 액션이 대신 검사한다.
ALTER TABLE mission_photo_likes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_photo_likes_all" ON mission_photo_likes;
CREATE POLICY "mission_photo_likes_all" ON mission_photo_likes
  FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────
-- 2) mission_submissions.like_count — 피드가 매번 COUNT 하지 않도록
--
--    피드는 사진 60장을 한 번에 그린다. 장마다 COUNT 를 돌리면 60번이다.
--    tori_fm_requests.heart_count 와 같은 방식으로 트리거가 맞춰준다.
-- ─────────────────────────────────────────────────────
ALTER TABLE mission_submissions
  ADD COLUMN IF NOT EXISTS like_count int NOT NULL DEFAULT 0;

COMMENT ON COLUMN mission_submissions.like_count IS
  '이 제출물이 받은 좋아요 수. mission_photo_likes 트리거가 동기화한다. '
  '도토리는 이 값이 아니라 min(5, like_count) 로 정산된다.';

CREATE OR REPLACE FUNCTION sync_submission_like_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE mission_submissions
       SET like_count = like_count + 1
     WHERE id = NEW.submission_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE mission_submissions
       SET like_count = GREATEST(0, like_count - 1)
     WHERE id = OLD.submission_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS trg_sync_submission_like_count ON mission_photo_likes;
CREATE TRIGGER trg_sync_submission_like_count
  AFTER INSERT OR DELETE ON mission_photo_likes
  FOR EACH ROW EXECUTE FUNCTION sync_submission_like_count();

-- 이미 쌓인 좋아요가 있으면 맞춰 둔다(재실행 안전).
UPDATE mission_submissions s
   SET like_count = COALESCE(l.n, 0)
  FROM (
    SELECT submission_id, COUNT(*)::int AS n
      FROM mission_photo_likes GROUP BY submission_id
  ) l
 WHERE l.submission_id = s.id AND s.like_count <> l.n;


-- ─────────────────────────────────────────────────────
-- 3) toggle_photo_like() — 누르기/취소 + 도토리 정산을 한 트랜잭션으로
--
--    서버 액션에서 "세고 → 넣고 → 도토리 계산하고 → 원장 쓰고 → 잔액 고치기" 를
--    순서대로 하면, 두 가족이 같은 사진을 동시에 누를 때 개수를 잘못 세서 도토리가
--    새거나 빈다. 제출물 행을 잠근 채 한 번에 끝낸다.
--
--    잔액 아래로는 회수하지 않는다: app_users.acorn_balance 에 CHECK(>= 0) 가 걸려
--    있고, 무엇보다 아이들 행사에서 "도토리 -2개" 는 설명할 방법이 없다. 덜 깎은
--    만큼은 원장에도 그만큼만 적어 잔액 = 원장 합계 불변식을 지킨다.
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION toggle_photo_like(
  p_submission_id uuid,
  p_user_id       uuid,
  p_event_id      uuid DEFAULT NULL,
  p_max_per_mission int DEFAULT 3,
  p_acorn_cap     int DEFAULT 5
)
RETURNS TABLE (
  liked            boolean,
  like_count       int,
  my_likes_in_mission int,
  acorn_delta      int
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_mission   uuid;
  v_owner     uuid;
  v_status    text;
  v_existing  uuid;
  v_count     int;
  v_mine      int;
  v_target    int;
  v_granted   int;
  v_delta     int;
  v_balance   int;
  v_was_liked boolean;
BEGIN
  SELECT org_mission_id, user_id, status
    INTO v_mission, v_owner, v_status
    FROM mission_submissions
   WHERE id = p_submission_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION '사진을 찾을 수 없어요';
  END IF;
  IF v_owner = p_user_id THEN
    RAISE EXCEPTION '내 사진에는 좋아요를 누를 수 없어요';
  END IF;
  IF v_status NOT IN ('AUTO_APPROVED', 'APPROVED') THEN
    RAISE EXCEPTION '아직 기관이 확인하지 않은 사진이에요';
  END IF;

  SELECT id INTO v_existing
    FROM mission_photo_likes
   WHERE submission_id = p_submission_id AND from_user_id = p_user_id;

  IF v_existing IS NULL THEN
    -- 누르기 — 이 미션에서 몇 개 썼는지 먼저 센다.
    SELECT COUNT(*)::int INTO v_mine
      FROM mission_photo_likes
     WHERE org_mission_id = v_mission AND from_user_id = p_user_id;

    IF v_mine >= p_max_per_mission THEN
      RAISE EXCEPTION '이 미션에서 누를 수 있는 좋아요를 다 썼어요';
    END IF;

    INSERT INTO mission_photo_likes
      (submission_id, org_mission_id, from_user_id, event_id)
    VALUES
      (p_submission_id, v_mission, p_user_id, p_event_id);
    v_was_liked := true;
  ELSE
    -- 취소
    DELETE FROM mission_photo_likes WHERE id = v_existing;
    v_was_liked := false;
  END IF;

  SELECT COUNT(*)::int INTO v_count
    FROM mission_photo_likes WHERE submission_id = p_submission_id;
  SELECT COUNT(*)::int INTO v_mine
    FROM mission_photo_likes
   WHERE org_mission_id = v_mission AND from_user_id = p_user_id;

  -- 도토리 재계산 — 준 적 있는 총액은 원장이 진실이다.
  v_target := LEAST(p_acorn_cap, v_count);
  SELECT COALESCE(SUM(amount), 0)::int INTO v_granted
    FROM user_acorn_transactions
   WHERE source_type = 'photo_like' AND source_id = p_submission_id;
  v_delta := v_target - v_granted;

  IF v_delta < 0 THEN
    SELECT acorn_balance INTO v_balance FROM app_users WHERE id = v_owner FOR UPDATE;
    v_delta := -LEAST(-v_delta, COALESCE(v_balance, 0));
  END IF;

  IF v_delta <> 0 THEN
    INSERT INTO user_acorn_transactions
      (user_id, amount, reason, source_type, source_id, memo, event_id)
    VALUES (
      v_owner, v_delta, 'PHOTO_LIKE', 'photo_like', p_submission_id,
      CASE WHEN v_delta > 0 THEN '사진 좋아요' ELSE '사진 좋아요 취소' END,
      p_event_id
    );
    UPDATE app_users
       SET acorn_balance = acorn_balance + v_delta
     WHERE id = v_owner;
  END IF;

  RETURN QUERY SELECT v_was_liked, v_count, v_mine, v_delta;
END $$;


-- ─────────────────────────────────────────────────────
-- 4) 실시간
--
--    하트 수는 mission_submissions.like_count 로 흘러가고 그 테이블은 이미
--    publication 에 있다(20260828000000). 좋아요를 누르면 UPDATE 가 나가므로
--    참가자 화면은 지금 구독만으로 따라온다 — 새 테이블을 더 실을 필요가 없다.
-- ─────────────────────────────────────────────────────


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_likes int;
  n_acorn int;
  n_drift int;
BEGIN
  SELECT COUNT(*) INTO n_likes FROM mission_photo_likes;
  SELECT COALESCE(SUM(amount), 0) INTO n_acorn
    FROM user_acorn_transactions WHERE source_type = 'photo_like';

  SELECT COUNT(*) INTO n_drift
    FROM app_users u
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total
        FROM user_acorn_transactions GROUP BY user_id
    ) t ON t.user_id = u.id
   WHERE u.acorn_balance <> COALESCE(t.total, 0);

  RAISE NOTICE '좋아요 % 건 — 좋아요로 오간 도토리 % 개', n_likes, n_acorn;
  RAISE NOTICE '한 미션에서 3개까지, 한 사진이 받는 도토리는 5개까지입니다.';
  IF n_drift > 0 THEN
    RAISE WARNING '잔액 ≠ 원장 합계인 계정 % 명 — 좋아요와 무관한 기존 불일치입니다.', n_drift;
  ELSE
    RAISE NOTICE '잔액과 원장 합계가 모두 일치합니다.';
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
