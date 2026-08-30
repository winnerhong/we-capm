-- =====================================================
-- 설문이 스스로 열리게 — 행사 종료 몇 분 전부터
--
-- 배경:
--   설문은 스위치(survey_enabled) 하나로만 열렸다. 그러면 기관이 **행사 중에**
--   그 스위치를 눌러야 한다. 행사장에서 아이들 챙기는 사람이 그걸 기억할 수
--   없고, 집에 가서 켜면 이미 늦다 — 카톡으로 링크를 보내도 안 읽는다.
--
--   설문은 아직 행사장에 있을 때 받아야 한다. 그래서 여는 일은 시계에 맡긴다.
--     스위치(준비 단계에서 한 번)  ×  종료 30분 전이 됐나(자동)  →  열림
--
-- 저장 형식이 "시각" 이 아니라 "분" 인 이유:
--   invitation_entry_lead_min 과 같다. 행사 시각을 나중에 바꿔도 따라온다.
--
-- NULL = 자동으로 열지 않음. 기관이 🏁 종료를 눌러야 열린다(지금까지의 동작).
--   종료 시각(ends_at)을 안 적은 행사도 자연히 이 길로 흘러간다 — 기준이 없으면
--   계산할 수 없다.
--
-- 닫는 시각은 두지 않는다:
--   늦게 낸 답을 버릴 이유가 없다. 그만 받고 싶으면 스위치를 끈다.
--
-- 기본값 30 — 기존 행사도 같이 얻는다. 스위치가 꺼져 있으면 아무 일도 없으므로
--   (설문을 안 받기로 한 행사가 갑자기 열리지 않는다) 소급 적용이 안전하다.
--
-- 재실행 안전(idempotent).
-- =====================================================

ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS survey_open_lead_min int NULL DEFAULT 30;

DO $$ BEGIN
  ALTER TABLE org_events
    ADD CONSTRAINT org_events_survey_lead_range
    CHECK (
      survey_open_lead_min IS NULL
      OR survey_open_lead_min BETWEEN 0 AND 240
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN org_events.survey_open_lead_min IS
  '설문이 열리는 시각 — 행사 종료 몇 분 전부터. NULL 또는 0 이면 자동으로 '
  '열지 않고 기관이 행사를 종료(ENDED)해야 열린다. 시각이 아니라 분으로 두는 '
  '이유: 행사 시각이 바뀌어도 자동으로 따라오게.';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_on   int;
  n_auto int;
BEGIN
  SELECT COUNT(*) INTO n_on FROM org_events WHERE survey_enabled;
  SELECT COUNT(*) INTO n_auto
    FROM org_events
   WHERE survey_enabled
     AND ends_at IS NOT NULL
     AND COALESCE(survey_open_lead_min, 0) > 0;
  RAISE NOTICE '설문 켠 행사 % 개 · 그중 스스로 열리는 행사 % 개', n_on, n_auto;
  RAISE NOTICE '스위치가 꺼진 행사는 이 값과 무관합니다 — 갑자기 열리지 않습니다.';
END $$;

NOTIFY pgrst, 'reload schema';
