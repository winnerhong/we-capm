-- =====================================================
-- 행사 설문 — 끝나고 보호자에게 묻는 세 가지
--
-- 배경:
--   행사가 끝나면 기관이 남는 건 참여 숫자뿐이었다. "좋았나요" 를 물을 자리가
--   아예 없어서, 다음 행사를 고칠 근거가 없었다.
--
-- 문항을 세 개로 못 박은 이유:
--   행사장에서 아이 손 잡고 폰으로 답한다. 다섯 문항을 넘기면 아무도 끝까지
--   안 한다. 별점 하나 + 가장 좋았던 것 + 한 줄이면 다음 행사를 고치기에 충분하다.
--   문항을 기관이 직접 만들게 하지 않는 것도 같은 이유다 — 만들 수 있게 하면
--   길어지고, 길어지면 응답률이 0 이 된다.
--
-- 한 사람 한 번:
--   UNIQUE (event_id, user_id) 로 막고, 다시 내면 덮어쓴다(고칠 수 있어야 한다).
--
-- 재실행 안전(idempotent).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) org_events — 설문 받기 스위치
--
--    행사마다 켜고 끈다. 켜기 전에는 참가자 화면에 아무것도 나타나지 않는다.
-- ─────────────────────────────────────────────────────
ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS survey_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN org_events.survey_enabled IS
  '행사 설문을 받을지. 켜면 참가자 화면에 설문 카드가 뜬다. 기본 false — '
  '행사가 끝날 무렵 기관이 켠다.';


-- ─────────────────────────────────────────────────────
-- 2) event_survey_responses — 응답
--
--    best_mission_id 를 org_missions 참조로 두는 이유: "가장 좋았던 미션" 을
--    자유 입력으로 받으면 집계가 안 된다. 고르게 하면 다음 행사에서 무엇을
--    남기고 무엇을 뺄지 바로 나온다.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_survey_responses (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        uuid NOT NULL REFERENCES org_events(id) ON DELETE CASCADE,
  user_id         uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  rating          int  NOT NULL CHECK (rating BETWEEN 1 AND 5),
  best_mission_id uuid NULL REFERENCES org_missions(id) ON DELETE SET NULL,
  comment         text NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_survey_event
  ON event_survey_responses (event_id, created_at DESC);

-- TODO(phase1): auth.uid() = user_id 로 조인다. 지금은 참가자에게 Supabase Auth
-- 세션이 없어 서버 액션이 대신 검사한다(다른 참가자 테이블과 같은 상태).
ALTER TABLE event_survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "event_survey_responses_all" ON event_survey_responses;
CREATE POLICY "event_survey_responses_all" ON event_survey_responses
  FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────
-- 3) 집계 뷰 — 결과 화면이 매번 평균을 계산하지 않도록
-- ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS view_event_survey_summary;

CREATE VIEW view_event_survey_summary AS
SELECT
  e.id AS event_id,
  COALESCE(COUNT(r.id), 0)::int AS response_count,
  ROUND(AVG(r.rating)::numeric, 2) AS avg_rating,
  COALESCE(COUNT(r.id) FILTER (WHERE COALESCE(TRIM(r.comment), '') <> ''), 0)::int
    AS comment_count
FROM org_events e
LEFT JOIN event_survey_responses r ON r.event_id = e.id
GROUP BY e.id;

COMMENT ON VIEW view_event_survey_summary IS
  '행사별 설문 요약 — 응답 수, 평균 별점, 의견이 적힌 응답 수.';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_on  int;
  n_res int;
BEGIN
  SELECT COUNT(*) INTO n_on FROM org_events WHERE survey_enabled;
  SELECT COUNT(*) INTO n_res FROM event_survey_responses;
  RAISE NOTICE '설문 켠 행사 % 개 · 응답 % 건', n_on, n_res;
  RAISE NOTICE '문항은 셋(별점·가장 좋았던 미션·한 줄)뿐입니다 — 길어지면 아무도 끝까지 안 합니다.';
END $$;

NOTIFY pgrst, 'reload schema';
