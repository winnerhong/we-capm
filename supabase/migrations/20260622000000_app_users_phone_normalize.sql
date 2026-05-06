-- app_users.phone 정규화 — 레거시 데이터(하이픈/공백 포함) 일괄 변환.
--
-- 배경: 일부 초기 임포트 경로에서 학부모 연락처가 "010-1234-5678" 또는
--       "010 1234 5678" 형태로 저장됨. 로그인은 숫자만으로 매칭(010xxxxxxxx)
--       하므로 일치하지 않아 "등록되지 않은 번호" 오류 발생.
--
-- 조치:
--   1) 모든 phone 값을 숫자만 남도록 regexp_replace
--   2) 길이 10~11자리 + 010 접두 외 행은 NULL 처리하지 않음 (수동 검수 대상)
--   3) phone 컬럼에 CHECK 제약 추가 — 향후 재발 방지
--
-- 안전: UPDATE 는 이미 숫자만 들어있는 행에는 영향 없음(idempotent).

-- 1) 일괄 정규화
UPDATE app_users
   SET phone = regexp_replace(phone, '\D', '', 'g')
 WHERE phone IS NOT NULL
   AND phone <> regexp_replace(phone, '\D', '', 'g');

-- 2) 중복 phone 감지 — 이미 같은 번호로 다른 행이 있으면 머지가 필요하니 경고만
--    (수동 검수). UNIQUE 제약은 추후 별도 마이그레이션에서.
DO $$
DECLARE
  dup_count int;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT phone FROM app_users
     WHERE phone IS NOT NULL
     GROUP BY phone HAVING COUNT(*) > 1
  ) d;
  IF dup_count > 0 THEN
    RAISE NOTICE '⚠ phone 중복 % 건 — 수동 머지 필요', dup_count;
  END IF;
END $$;

-- 3) CHECK 제약 — 숫자 10~11자리만 허용
ALTER TABLE app_users
  DROP CONSTRAINT IF EXISTS app_users_phone_format;
ALTER TABLE app_users
  ADD CONSTRAINT app_users_phone_format
  CHECK (phone IS NULL OR phone ~ '^\d{10,11}$');

-- 4) 인덱스는 이미 idx_app_users_phone 존재 (20260514). 재확인만.
CREATE INDEX IF NOT EXISTS idx_app_users_phone ON app_users(phone);

-- 5) PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
