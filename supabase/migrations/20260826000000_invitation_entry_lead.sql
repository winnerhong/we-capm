-- =====================================================
-- 입장가능시간을 기관이 정할 수 있게
--
-- 배경:
--   초대장의 "🚪 입장가능시간: 오전 09:20 (20분 전)" 이 코드에 박힌 20분이었다.
--   대관 시간 때문에 10분 전부터만 여는 곳, 접수·체온 확인이 있어 40분 전부터
--   받아야 하는 곳이 제각각인데 코드를 고쳐야만 바뀌었다.
--
-- 저장 형식이 "시각" 이 아니라 "분" 인 이유:
--   행사 시각을 나중에 바꿔도 입장시간이 자동으로 따라온다. 시각으로 두면
--   09:40 → 10:00 으로 옮겼을 때 입장시간만 09:20 에 남아 어긋난다.
--
-- NULL = 숨김. 상시 개방·야외 모임처럼 입장 안내가 필요 없는 행사도 있다.
--   0 도 앱에서 숨김으로 취급한다(0을 넣는 의도는 "안 씀" 이다).
--
-- 기본값 20 — 지금 화면과 같은 값이라 기존 행사의 초대장이 그대로 유지된다.
--
-- 재실행 안전(idempotent).
-- =====================================================

ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS invitation_entry_lead_min int NULL DEFAULT 20;

DO $$ BEGIN
  ALTER TABLE org_events
    ADD CONSTRAINT org_events_entry_lead_range
    CHECK (
      invitation_entry_lead_min IS NULL
      OR invitation_entry_lead_min BETWEEN 0 AND 240
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN org_events.invitation_entry_lead_min IS
  '초대장 입장가능시간 — 행사 시작 몇 분 전부터 입장 가능한지. '
  'NULL 또는 0 이면 초대장에서 입장 안내 줄을 표시하지 않는다. '
  '시각이 아니라 분으로 두는 이유: 행사 시각이 바뀌어도 자동으로 따라오게.';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_total  int;
  n_hidden int;
BEGIN
  SELECT COUNT(*) INTO n_total FROM org_events;
  SELECT COUNT(*) INTO n_hidden
    FROM org_events
   WHERE invitation_entry_lead_min IS NULL OR invitation_entry_lead_min = 0;
  RAISE NOTICE '행사 % 개 · 입장 안내 숨김 % 개', n_total, n_hidden;
  RAISE NOTICE '기존 행사는 20분 전으로 채워져 초대장 표시가 지금과 같습니다.';
END $$;

NOTIFY pgrst, 'reload schema';
