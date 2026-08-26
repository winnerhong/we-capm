-- =====================================================
-- 행사 참가 접수·승인제
--
-- 배경:
--   지금은 초대장 CTA → /join/event/{id} → 연락처만 넣으면 즉시 참가자가 된다.
--   기관이 "누가 오는지" 통제할 수단이 없고, 반·원아·인원 같은 운영 정보도
--   받지 못한다.
--
-- 바뀌는 것:
--   초대장 하단 신청서 → org_event_applications (PENDING)
--     → 기관 관리자가 수락한 건만 org_event_participants 로 승격.
--
-- 하위 호환:
--   org_events.applications_enabled 기본값 false → 기존 행사는 동작 그대로.
--   접수제를 켠 행사에서만 "바로 참가" 경로가 막힌다.
--
-- 재실행 안전(idempotent).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) org_events — 접수 설정 3종
-- ─────────────────────────────────────────────────────
ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS applications_enabled  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS applications_close_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS applications_capacity int NULL;

COMMENT ON COLUMN org_events.applications_enabled IS
  '참가 접수·승인제 사용. true 면 초대장 하단에 신청서가 뜨고, 승인 없이는 '
  '참가자가 될 수 없다(자가 참가 경로 전면 차단).';
COMMENT ON COLUMN org_events.applications_close_at IS
  '접수 마감 시각. NULL 이면 무기한. 지나면 신청 폼 대신 마감 안내가 뜬다 '
  '(이미 들어온 신청서는 계속 승인 가능).';
COMMENT ON COLUMN org_events.applications_capacity IS
  '정원 — 승인된 신청서의 party_size 합계 기준(건수 아님). NULL 이면 무제한. '
  '도달해도 접수는 계속 받되 "대기 접수" 로 안내한다.';

-- 정원은 양수만 (NULL 허용). 이미 있으면 건드리지 않는다.
DO $$ BEGIN
  ALTER TABLE org_events
    ADD CONSTRAINT org_events_applications_capacity_positive
    CHECK (applications_capacity IS NULL OR applications_capacity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- ─────────────────────────────────────────────────────
-- 2) org_event_participants — 가족 단위 참석 인원
--    신청서의 party_size 를 승인 시 그대로 복사한다.
--    기존 행(관리자가 직접 등록)은 1명으로 간주.
-- ─────────────────────────────────────────────────────
ALTER TABLE org_event_participants
  ADD COLUMN IF NOT EXISTS party_size int NOT NULL DEFAULT 1;

DO $$ BEGIN
  ALTER TABLE org_event_participants
    ADD CONSTRAINT org_event_participants_party_size_range
    CHECK (party_size BETWEEN 1 AND 20);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN org_event_participants.party_size IS
  '이 가족이 실제로 참석하는 총 인원(어른 포함). 접수 승인 시 신청서 값 복사. '
  '관리자 직접 등록분은 기본 1.';


-- ─────────────────────────────────────────────────────
-- 3) org_event_applications — 참가 신청서
--
--    children 을 정규화 테이블 대신 jsonb 로 두는 이유:
--      신청서는 "제출 당시 스냅샷" 이고, 승인 시점에 app_children 으로
--      정규화되어 넘어간다. 신청서 자체를 반명으로 검색할 요건은 없다.
--      형태: [{"name":"홍유빈","class_name":"햇살반"}, ...]
--
--    reviewed_by 가 uuid 가 아니라 text 인 이유:
--      기관 검수자 식별자는 partner_orgs.auto_username(전화번호 문자열).
--      20260728_reviewed_by_text.sql 에서 같은 이유로 mission_submissions 를
--      uuid → text 로 바꿨다. 같은 규약을 따른다.
-- ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS org_event_applications (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         uuid NOT NULL REFERENCES org_events(id)   ON DELETE CASCADE,
  org_id           uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  phone            text NOT NULL,
  children         jsonb NOT NULL DEFAULT '[]'::jsonb,
  party_size       int  NOT NULL DEFAULT 1
                     CHECK (party_size BETWEEN 1 AND 20),
  status           text NOT NULL DEFAULT 'PENDING'
                     CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  note             text NULL,
  approved_user_id uuid NULL REFERENCES app_users(id) ON DELETE SET NULL,
  reviewed_by      text NULL,
  reviewed_at      timestamptz NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE org_event_applications IS
  '행사 참가 신청서. 초대장 하단 폼으로 접수되며, 기관이 수락(APPROVED)해야 '
  'org_event_participants 로 승격된다.';
COMMENT ON COLUMN org_event_applications.phone IS
  'normalizeUserPhone 결과 — 하이픈 없는 숫자만. app_users.phone 과 같은 규약.';
COMMENT ON COLUMN org_event_applications.children IS
  '[{"name":"홍유빈","class_name":"햇살반"}] — 제출 당시 스냅샷. 승인 시 '
  'app_children 으로 정규화된다.';
COMMENT ON COLUMN org_event_applications.note IS
  '거절 사유(관리자 입력). 신청자에게는 노출하지 않는다.';

-- 한 연락처는 행사당 신청 1건. 형제·자매는 children 배열로 묶는다.
--   재제출은 UPDATE 로 처리 (PENDING/REJECTED 는 덮어쓰기, APPROVED 는 거부).
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_event_applications_event_phone
  ON org_event_applications (event_id, phone);

-- 접수 탭 목록 — 행사 + 상태 필터 + 최신순.
CREATE INDEX IF NOT EXISTS idx_org_event_applications_event_status
  ON org_event_applications (event_id, status, created_at DESC);

-- 기관 전체 대기 건수(대시보드 배지).
CREATE INDEX IF NOT EXISTS idx_org_event_applications_org_pending
  ON org_event_applications (org_id)
  WHERE status = 'PENDING';

-- updated_at auto-touch (org_events 트리거와 같은 패턴)
CREATE OR REPLACE FUNCTION touch_org_event_applications_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_touch_org_event_applications ON org_event_applications;
CREATE TRIGGER trg_touch_org_event_applications
  BEFORE UPDATE ON org_event_applications
  FOR EACH ROW EXECUTE FUNCTION touch_org_event_applications_updated_at();

ALTER TABLE org_event_applications ENABLE ROW LEVEL SECURITY;

-- TODO(phase1): SELECT/UPDATE 는 해당 org 관리자만. INSERT 는 발행된 초대장의
--   접수 열린 행사에 한해 익명 허용. 현재는 앱 계층에서 통제(기존 테이블과 동일).
DROP POLICY IF EXISTS "org_event_applications_all" ON org_event_applications;
CREATE POLICY "org_event_applications_all" ON org_event_applications
  FOR ALL USING (true) WITH CHECK (true);


-- ─────────────────────────────────────────────────────
-- 4) 집계 뷰 — 탭 배지 / 정원 게이지용
--    approved_people = 승인된 신청서 인원 합계 (정원 비교 기준)
-- ─────────────────────────────────────────────────────
CREATE OR REPLACE VIEW view_org_event_application_counts AS
SELECT
  e.id AS event_id,
  e.org_id,
  COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'PENDING'), 0)::int
    AS pending_count,
  COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'APPROVED'), 0)::int
    AS approved_count,
  COALESCE(COUNT(a.id) FILTER (WHERE a.status = 'REJECTED'), 0)::int
    AS rejected_count,
  COALESCE(SUM(a.party_size) FILTER (WHERE a.status = 'APPROVED'), 0)::int
    AS approved_people
FROM org_events e
LEFT JOIN org_event_applications a ON a.event_id = e.id
GROUP BY e.id, e.org_id;

COMMENT ON VIEW view_org_event_application_counts IS
  '행사별 접수 현황. approved_people 은 승인 인원 합계로, '
  'org_events.applications_capacity 와 직접 비교하는 값.';


-- ─────────────────────────────────────────────────────
-- 5) app_user_orgs.source — 접수 승인 경로 추가
--    CHECK 제약이 없는 text 컬럼이라 문서화만 갱신한다.
-- ─────────────────────────────────────────────────────
COMMENT ON COLUMN app_user_orgs.source IS
  '소속이 생긴 경로: backfill / bulk_import / self_register / admin / application. '
  '(invitation 은 폐기 — 행사 참가는 소속이 아니다. application 은 기관이 '
  '접수 신청서를 직접 수락한 경우로, 명단에 올린 것과 동일하게 본다)';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_events int;
  n_apps   int;
BEGIN
  SELECT COUNT(*) INTO n_events FROM org_events WHERE applications_enabled;
  SELECT COUNT(*) INTO n_apps   FROM org_event_applications;
  RAISE NOTICE '접수제 켜진 행사 % 개 / 신청서 % 건', n_events, n_apps;
  RAISE NOTICE '기존 행사는 전부 applications_enabled=false 로 동작이 바뀌지 않습니다.';
END $$;

NOTIFY pgrst, 'reload schema';
