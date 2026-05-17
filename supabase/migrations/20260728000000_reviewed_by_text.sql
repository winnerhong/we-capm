-- mission_submissions.reviewed_by 를 uuid → text 로 변경.
--
-- 배경:
--   - 기관 검수자 식별자는 partner_orgs.auto_username (전화번호 문자열) 인데
--     컬럼이 uuid 라 INSERT/UPDATE 시 "invalid input syntax for type uuid" 발생.
--   - cron 자동 승인도 'cron:auto_approve_24h' 같은 자유 문자열을 기록하려고
--     함 → 동일 사유로 깨짐 (잠재적 사일런트 실패).
--
-- 조치:
--   reviewed_by 를 text 로 바꿔 "누가 검토했는지" 자유 식별자 컬럼으로 정상화.
--   기존 UUID 값들은 USING reviewed_by::text 로 그대로 문자열 변환 보존.

ALTER TABLE public.mission_submissions
  ALTER COLUMN reviewed_by TYPE text USING reviewed_by::text;
