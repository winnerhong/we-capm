-- app_users 의 가입 경로 기록.
--   manual         : 운영자가 빠른 원생 추가 / 행사 명단에서 수동 등록
--   csv            : 엑셀/CSV 일괄 등록
--   self_register  : 초대장 링크에서 학부모가 직접 셀프 등록 (allow_self_register)
--   cross_org      : 타 기관 행사 참여로 자동 링크
--
-- 기존 데이터는 'manual' 로 백필. 신규 row 는 INSERT 시 명시적으로 지정해야
-- 정확하지만, 누락된 경우 default 'manual' 로 안전하게 떨어진다.

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS created_via text NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN app_users.created_via IS
  '가입 경로: manual / csv / self_register / cross_org';
