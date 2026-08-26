-- =====================================================
-- 참가 신청서 개인정보 수집·이용 동의
--
-- 배경:
--   초대장 신청서는 보호자 연락처·원아명·반명·동반 인원을 받으면서 개인정보
--   동의를 한 번도 받지 않았다. 수집 전 동의가 필요한 항목이고(개인정보보호법
--   제15조), 만 14세 미만 아동 정보라 법정대리인 동의도 이 자리에서 함께
--   받아야 한다(제22조의2). 지금은 그 근거가 어디에도 남지 않는다.
--
--   계열사가 참가 정보를 함께 쓰려면 공동이용 동의(제17조·제26조)가 별도로
--   필요하다. 다만 참가에 필수가 아니므로 "선택" 으로 받는다 — 선택 항목
--   미동의를 이유로 서비스를 거부하면 제22조 제5항 위반이다.
--
-- 왜 문구를 기관(partner_orgs)에 두는가:
--   행사마다 두면 행사 수만큼 관리해야 하고, 어느 행사만 옛 문구로 남는 사고가
--   난다. 반대로 플랫폼 전역 하나로 두면 위너그룹 계열이 아닌 기관에도 계열사
--   문구가 강제된다. 기관 단위가 이 둘 사이의 유일하게 맞는 지점이다.
--
-- 왜 동의한 전문을 신청서에 복사하는가:
--   기관이 문구를 고치면 이전 신청자가 동의한 내용과 달라진다. "현재 문구" 만
--   보관하면 나중에 무엇에 동의했는지 댈 수 없어 동의 기록의 의미가 사라진다.
--
-- 재실행 안전(idempotent).
-- =====================================================

-- ─────────────────────────────────────────────────────
-- 1) partner_orgs — 이 기관이 쓰는 동의 문구
--
--    NULL 이 곧 "코드 기본값 사용" 이다. 기본 문구를 DB 에 백필하지 않는 이유:
--    백필해 두면 나중에 기본 문구를 고쳐도 이미 복사된 기관들은 옛 문구에
--    묶인다. NULL 로 두면 손대지 않은 기관은 항상 최신 기본값을 따라온다.
-- ─────────────────────────────────────────────────────
ALTER TABLE partner_orgs
  ADD COLUMN IF NOT EXISTS application_consent_body             text NULL,
  ADD COLUMN IF NOT EXISTS application_consent_optional_body    text NULL,
  ADD COLUMN IF NOT EXISTS application_consent_optional_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS application_consent_updated_at       timestamptz NULL;

COMMENT ON COLUMN partner_orgs.application_consent_body IS
  '참가 신청서 [필수] 개인정보 수집·이용 동의 전문. '
  'NULL 이면 코드의 기본 문구를 쓴다(기본값을 DB 에 백필하지 않는다). '
  '{기관명} 토큰은 화면에 뿌릴 때 org_name 으로 치환된다.';
COMMENT ON COLUMN partner_orgs.application_consent_optional_body IS
  '참가 신청서 [선택] 계열사 공동이용 동의 전문. NULL 이면 코드 기본 문구.';
COMMENT ON COLUMN partner_orgs.application_consent_optional_enabled IS
  'false 면 선택 동의 줄 자체를 신청서에 띄우지 않는다. '
  '계열사 공동이용이 없는 외부 기관용.';
COMMENT ON COLUMN partner_orgs.application_consent_updated_at IS
  '기관이 문구를 마지막으로 고친 시각. 관리자 화면 표시용.';


-- ─────────────────────────────────────────────────────
-- 2) org_event_applications — 이 사람이 실제로 동의한 기록
--
--    전부 NULL 허용 + 기본값 없음. 기존 신청서를 거짓으로 "동의함" 으로
--    만들지 않는다 — NULL 은 "이 기능 도입 전에 들어온 신청서" 를 뜻하고,
--    관리자 화면도 그렇게 표시한다.
-- ─────────────────────────────────────────────────────
ALTER TABLE org_event_applications
  ADD COLUMN IF NOT EXISTS consent_agreed_at          timestamptz NULL,
  ADD COLUMN IF NOT EXISTS consent_optional_agreed_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS consent_snapshot           jsonb NULL;

COMMENT ON COLUMN org_event_applications.consent_agreed_at IS
  '[필수] 동의 시각. NULL 이면 동의 기능 도입 전에 접수된 신청서다 '
  '(동의를 거부한 것이 아니라 물어본 적이 없는 것).';
COMMENT ON COLUMN org_event_applications.consent_optional_agreed_at IS
  '[선택] 계열사 공동이용 동의 시각. NULL = 동의하지 않음. '
  '참가 자격에는 아무런 영향이 없다.';
COMMENT ON COLUMN org_event_applications.consent_snapshot IS
  '동의 당시 전문 그대로. {"required":"...","optional":"..."|null}. '
  '기관이 나중에 문구를 고쳐도 이 값은 바뀌지 않는다 — 무엇에 동의했는지를 '
  '증명하는 것이 이 컬럼의 존재 이유다. 서버가 만들어 넣는다(클라 전송값 불신).';


-- ─────────────────────────────────────────────────────
-- 검증 로그
-- ─────────────────────────────────────────────────────
DO $$
DECLARE
  n_orgs        int;
  n_customized  int;
  n_apps        int;
  n_no_consent  int;
BEGIN
  SELECT COUNT(*) INTO n_orgs FROM partner_orgs;
  SELECT COUNT(*) INTO n_customized
    FROM partner_orgs WHERE application_consent_body IS NOT NULL;
  SELECT COUNT(*) INTO n_apps FROM org_event_applications;
  SELECT COUNT(*) INTO n_no_consent
    FROM org_event_applications WHERE consent_agreed_at IS NULL;

  RAISE NOTICE '기관 % 개 (문구 직접 수정 % 개, 나머지는 코드 기본 문구)',
    n_orgs, n_customized;
  RAISE NOTICE '기존 신청서 % 건 중 % 건은 동의 기록 없음 — 도입 전 접수분입니다.',
    n_apps, n_no_consent;
  RAISE NOTICE '동의 기록이 없어도 승인·취소는 그대로 동작합니다.';
END $$;

NOTIFY pgrst, 'reload schema';
