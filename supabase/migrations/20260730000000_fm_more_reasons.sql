-- ============================================================
-- user_acorn_transactions.reason CHECK 확장
--   - FM_PLAYED        : 라디오 PLAYED 자동 보상
--   - FM_HEART         : 즉석 신청곡 하트
--   - FM_JUMP_FIRST    : 큐 #1 점프
--   - FM_CHEER_SEND    : NOW PLAYING 응원 소비
--   - FM_CHEER_RECEIVE : NOW PLAYING 응원 적립
--
-- 기존 INSERT 가 silently fail 하던 reasons 를 모두 허용.
-- 적용 후 잔액·원장 일관성은 새 응원/하트부터 정상화됨.
-- ============================================================

ALTER TABLE public.user_acorn_transactions
  DROP CONSTRAINT IF EXISTS user_acorn_transactions_reason_check;

ALTER TABLE public.user_acorn_transactions
  ADD CONSTRAINT user_acorn_transactions_reason_check
  CHECK (reason IN (
    'STAMP_SLOT','STAMPBOOK_COMPLETE','CHALLENGE','ATTENDANCE',
    'SPEND_COUPON','SPEND_DECORATION','ADMIN_GRANT','ADMIN_DEDUCT','OTHER',
    'MISSION','MISSION_REVERSE',
    'FM_BOOST','FM_BOOST_REFUND',
    'FM_PLAYED','FM_HEART','FM_JUMP_FIRST',
    'FM_CHEER_SEND','FM_CHEER_RECEIVE'
  ));
