-- ============================================================
-- user_acorn_transactions.reason CHECK 제약 영구 제거
--
-- 배경:
--   기존 CHECK 제약은 신규 reason("FM_CHEER_SEND" 등) 을 거부해
--   INSERT 가 silently fail. 그 결과 원장 row 가 비어 응원 카운트가
--   항상 0 으로 사라지던 버그가 있었음.
--
-   확장하려고 새 리스트를 만들었지만 기존 production 데이터에 ALLOW
--   리스트 밖의 legacy reason 값이 남아있어 DROP+ADD 가 23514 로 실패.
--
-- 결정:
--   reason 값은 application 코드(AcornReason union + tori-fm/actions enum) 에서
--   이미 통제되므로 DB 레벨 CHECK 는 필요 없음. 영구 제거.
-- ============================================================

ALTER TABLE public.user_acorn_transactions
  DROP CONSTRAINT IF EXISTS user_acorn_transactions_reason_check;
