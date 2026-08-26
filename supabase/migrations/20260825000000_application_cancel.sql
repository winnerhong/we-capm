-- =====================================================
-- 참가 취소 — 신청자가 스스로 빼고, 기관은 따로 관리
--
-- 배경:
--   초대장 상태 카드에 취소 수단이 없었다. 못 가게 되면 기관에 전화하는 것 말고는
--   방법이 없고, 관리자가 승인 취소를 하면 PENDING 으로 되돌아갈 뿐이라
--   "취소했다" 는 사실 자체가 남지 않았다.
--
--   취소된 건은 지우면 안 된다. 누가 언제 왜 빠졌는지는 정원 운영·간식 산정에
--   그대로 필요한 정보다.
--
-- 바뀌는 것:
--   status 에 CANCELED 추가. 참가자 명단에서는 빠지되 접수 탭 [취소] 목록에 남는다.
--
-- 정원(approved_people)은 status='APPROVED' 만 세므로 취소분이 자동으로 빠진다.
--
-- 재실행 안전(idempotent).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) status 값 확장 — CANCELED
--    CHECK 는 이름으로 지웠다 다시 건다. 제약 이름이 없으면(자동 생성명)
--    아래 DO 블록이 실제 이름을 찾아 지운다.
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT con.conname INTO c_name
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
   WHERE rel.relname = 'org_event_applications'
     AND con.contype = 'c'
     AND pg_get_constraintdef(con.oid) ILIKE '%status%'
   LIMIT 1;

  IF c_name IS NOT NULL THEN
    EXECUTE format(
      'ALTER TABLE org_event_applications DROP CONSTRAINT %I', c_name
    );
    RAISE NOTICE '기존 status 제약 % 제거', c_name;
  END IF;
END $$;

ALTER TABLE org_event_applications
  ADD CONSTRAINT org_event_applications_status_check
  CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELED'));


-- ─────────────────────────────────────────────────────
-- 2) 취소 시각 + 사유
--
--    cancel_reason 을 note 에 합치지 않는 이유:
--      note          = 관리자가 쓰고 신청자에게 안 보이는 거절 메모
--      cancel_reason = 신청자가 쓰고 관리자가 읽는 취소 사유 (반대 방향)
--    한 컬럼에 섞으면 어느 쪽에 보여줄지 판단할 근거가 사라진다.
-- ─────────────────────────────────────────────────────
ALTER TABLE org_event_applications
  ADD COLUMN IF NOT EXISTS canceled_at   timestamptz NULL,
  ADD COLUMN IF NOT EXISTS cancel_reason text NULL;

COMMENT ON COLUMN org_event_applications.canceled_at IS
  '취소 시각. status=CANCELED 일 때만 채워진다. 재신청하면 다시 NULL.';
COMMENT ON COLUMN org_event_applications.cancel_reason IS
  '신청자(또는 대신 처리한 관리자)가 남긴 취소 사유. 선택 입력. '
  'note(관리자 전용 거절 메모)와는 방향이 반대라 컬럼을 나눈다.';

-- 취소 목록 조회 — 최근 취소순.
CREATE INDEX IF NOT EXISTS idx_org_event_applications_canceled
  ON org_event_applications (event_id, canceled_at DESC)
  WHERE status = 'CANCELED';


-- ─────────────────────────────────────────────────────
-- 3) 현황 뷰 — canceled_count 추가
--    approved_people 은 그대로. APPROVED 만 세므로 취소분은 이미 빠진다.
--
--    CREATE OR REPLACE 가 아니라 DROP 후 재생성인 이유:
--      REPLACE 는 컬럼을 "맨 뒤에 추가" 만 허용한다. canceled_count 를
--      rejected_count 옆(논리적 자리)에 두면 기존 5번째 컬럼 이름이 바뀌는
--      꼴이라 42P16 "cannot change name of view column" 으로 실패한다.
--      이 뷰에 의존하는 DB 객체는 없고(앱이 PostgREST 로 이름 기준 조회),
--      드롭·재생성이 안전하다.
-- ─────────────────────────────────────────────────────
DROP VIEW IF EXISTS view_org_event_application_counts;

CREATE VIEW view_org_event_application_counts AS
SELECT
  e.id AS event_id,
  e.org_id,
  COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'PENDING'), 0)::int
    AS pending_count,
  COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'APPROVED'), 0)::int
    AS approved_count,
  COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'REJECTED'), 0)::int
    AS rejected_count,
  COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'CANCELED'), 0)::int
    AS canceled_count,
  COALESCE(SUM(a.party_size) FILTER (WHERE a.status = 'APPROVED'), 0)::int
    AS approved_people
FROM org_events e
LEFT JOIN org_event_applications a ON a.event_id = e.id
GROUP BY e.id, e.org_id;

COMMENT ON VIEW view_org_event_application_counts IS
  '행사별 접수 현황. approved_people 은 승인 인원 합계로, '
  'org_events.applications_capacity 와 직접 비교하는 값 (취소분은 빠진다).';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_canceled int;
BEGIN
  SELECT COUNT(*) INTO n_canceled
    FROM org_event_applications WHERE status = 'CANCELED';
  RAISE NOTICE '취소된 신청서 % 건', n_canceled;
  RAISE NOTICE '취소는 삭제가 아니라 상태 전환입니다 — 접수 탭 [취소] 필터에서 계속 보입니다.';
END $$;

NOTIFY pgrst, 'reload schema';
