-- =====================================================
-- 참가 인원 → 동반인 명단 (아동/성인 자동 합산)
--
-- 배경:
--   신청 폼의 참가 인원이 숫자 카운터 하나였다. 3명이 아빠·엄마·아이인지
--   아이와 조부모인지 알 수 없어 간식·보험·좌석 준비에 쓸 수가 없었고,
--   신청자가 직접 세야 해서 자녀를 추가해도 숫자가 따라오지 않았다.
--
-- 바뀌는 것:
--   함께 오시는 분을 유형(아빠/엄마/할머니/삼촌…)별로 한 명씩 추가하고,
--   총 인원은 자동 합산한다. 아동 = 참가 아이 + 아동 동반인.
--
-- party_size 는 그대로 둔다 — 정원 계산(approved_people 합계)이 이미 이 값을
--   쓰고 있고, 이제 파생값(아동+성인)으로만 채워질 뿐이다.
--
-- 재실행 안전(idempotent).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) org_event_applications.companions
--
--    형태: [{"label":"아빠","kind":"ADULT"}, {"label":"동생","kind":"CHILD"}]
--
--    children 을 jsonb 로 둔 것과 같은 이유 — 신청서는 "제출 당시 스냅샷" 이고,
--    동반인 유형으로 검색·집계할 요건이 없다. 인원 합계는 party_size 컬럼이
--    이미 들고 있다.
-- ─────────────────────────────────────────────────────
ALTER TABLE org_event_applications
  ADD COLUMN IF NOT EXISTS companions jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN org_event_applications.companions IS
  '함께 오는 사람 목록 — [{"label":"아빠","kind":"ADULT"}]. '
  'kind 는 ADULT | CHILD. 아동 수 = children 길이 + kind=CHILD 동반인 수, '
  '성인 수 = kind=ADULT 동반인 수, 합계 = party_size.';


-- ─────────────────────────────────────────────────────
-- 2) org_event_participants — 아동/성인 구성
--
--    승인 시 신청서에서 복사한다. 관리자가 직접 등록한 기존 행은 0/0 으로
--    남고, 화면은 그때만 구성 배지를 숨기고 party_size 총합만 보여준다
--    (0명으로 오해하지 않게).
-- ─────────────────────────────────────────────────────
ALTER TABLE org_event_participants
  ADD COLUMN IF NOT EXISTS adult_count int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS child_count int NOT NULL DEFAULT 0;

DO $$ BEGIN
  ALTER TABLE org_event_participants
    ADD CONSTRAINT org_event_participants_headcount_range
    CHECK (adult_count BETWEEN 0 AND 20 AND child_count BETWEEN 0 AND 20);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN org_event_participants.adult_count IS
  '이 가족의 성인 참석 인원. 접수 승인 시 신청서에서 복사. '
  '관리자 직접 등록분은 0 (미상) — 화면에서 배지를 숨긴다.';
COMMENT ON COLUMN org_event_participants.child_count IS
  '이 가족의 아동 참석 인원(참가 아이 + 아동 동반인). 접수 승인 시 복사. '
  '관리자 직접 등록분은 0 (미상).';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_apps   int;
  n_withco int;
BEGIN
  SELECT COUNT(*) INTO n_apps FROM org_event_applications;
  SELECT COUNT(*) INTO n_withco
    FROM org_event_applications WHERE jsonb_array_length(companions) > 0;
  RAISE NOTICE '신청서 % 건 (동반인 기록 있는 건 % 건)', n_apps, n_withco;
  RAISE NOTICE '기존 신청서는 companions=[] 로 남고, 화면은 총 인원만 표시합니다.';
END $$;

NOTIFY pgrst, 'reload schema';
