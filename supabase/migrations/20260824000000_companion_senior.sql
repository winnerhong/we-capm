-- =====================================================
-- 동반인 구분에 "조부모" 추가 (성인 / 조부모 / 아동)
--
-- 배경:
--   동반인이 성인·아동 2분류뿐이라 할머니·할아버지가 성인에 섞였다.
--   운영에서는 "유아 15 · 성인 20 · 조부모 7" 처럼 셋으로 나눠 봐야
--   좌석·간식·이동 준비가 잡힌다.
--
--   companions.kind 는 jsonb 안의 값이라 DDL 이 필요 없다(ADULT|SENIOR|CHILD).
--   참가자 테이블에만 조부모 인원 컬럼을 더한다.
--
-- 기존 신청서 데이터 보정은 불필요 — 아직 신청서가 없다.
--   혹시 있더라도 SENIOR 가 아닌 값은 전부 성인으로 읽히므로 안전하다.
--
-- 재실행 안전(idempotent).
-- =====================================================

ALTER TABLE org_event_participants
  ADD COLUMN IF NOT EXISTS senior_count int NOT NULL DEFAULT 0;

-- 기존 인원 CHECK 를 조부모까지 포함하도록 교체.
--   (20260823 에서 만든 제약을 지우고 다시 건다 — 재실행 안전)
ALTER TABLE org_event_participants
  DROP CONSTRAINT IF EXISTS org_event_participants_headcount_range;

ALTER TABLE org_event_participants
  ADD CONSTRAINT org_event_participants_headcount_range
  CHECK (
    adult_count  BETWEEN 0 AND 20 AND
    senior_count BETWEEN 0 AND 20 AND
    child_count  BETWEEN 0 AND 20
  );

COMMENT ON COLUMN org_event_participants.senior_count IS
  '이 가족의 조부모 참석 인원. 접수 승인 시 신청서에서 복사. '
  '관리자 직접 등록분은 0 (미상) — 화면에서 배지를 숨긴다.';

COMMENT ON COLUMN org_event_participants.adult_count IS
  '이 가족의 성인(조부모 제외) 참석 인원. 접수 승인 시 신청서에서 복사. '
  '관리자 직접 등록분은 0 (미상).';

COMMENT ON COLUMN org_event_applications.companions IS
  '함께 오는 사람 목록 — [{"label":"할머니","kind":"SENIOR"}]. '
  'kind 는 ADULT | SENIOR | CHILD. '
  '유아 = children 길이 + kind=CHILD 수, 성인 = kind=ADULT 수, '
  '조부모 = kind=SENIOR 수, 합계 = party_size.';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_parts int;
  n_known int;
BEGIN
  SELECT COUNT(*) INTO n_parts FROM org_event_participants;
  SELECT COUNT(*) INTO n_known
    FROM org_event_participants
   WHERE adult_count + senior_count + child_count > 0;
  RAISE NOTICE '행사 참가 %건 중 구성이 기록된 건 %건', n_parts, n_known;
  RAISE NOTICE '나머지는 접수를 거치지 않고 등록된 참가자로, 통계에서 "구성 미확인" 으로 표시됩니다.';
END $$;

NOTIFY pgrst, 'reload schema';
