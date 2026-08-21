-- =====================================================
-- 도토리 원장 정합성 복구 — 잔액과 원장 합계를 일치시킨다.
--
-- 배경:
--   app_users.acorn_balance 는 지금까지 두 갈래로 갱신돼 왔다.
--     · 미션·FM  → user_acorn_transactions 기록 + 잔액 갱신  (정상)
--     · 온보딩 보상 / 형제 보너스 → 잔액만 갱신, 원장 없음   (누락)
--   그 결과 231명 중 79명의 잔액이 원장 합계와 어긋나 있다.
--   (예: 잔액 21, 원장 합계 -2 → 차이 23)
--
-- 왜 지금 고치나:
--   도토리를 행사 단위로 집계하려면 원장이 진실의 원천이어야 한다.
--   원장에 없는 도토리는 어느 행사에 귀속시킬지 판단할 근거가 없다.
--
-- 방침 — 잔액은 한 개도 줄이지 않는다:
--   원장을 잔액에 맞춰 올린다(반대 방향 X). 차액만큼 보정 행을 만든다.
--   잔액이 원장보다 "적은" 경우(환불·차감 누락)도 같은 방식으로 음수 보정.
--
-- 코드 쪽 누락은 같은 배포에서 수정됨:
--   src/app/(user)/profile/actions.ts — recordAcornGrant() 추가
--
-- 재실행 안전: 이미 보정된 유저는 차액이 0이라 다시 잡히지 않는다.
-- =====================================================

-- 1) 보정 전 현황 로그
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
    FROM app_users u
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total
        FROM user_acorn_transactions
       GROUP BY user_id
    ) t ON t.user_id = u.id
   WHERE u.acorn_balance <> COALESCE(t.total, 0);
  RAISE NOTICE '보정 대상: % 명', n;
END $$;

-- 2) 차액을 보정 행으로 기록
--    reason 은 자유 텍스트(CHECK 없음). 소급분임이 드러나도록 전용 값 사용.
INSERT INTO user_acorn_transactions (user_id, amount, reason, source_type, source_id, memo)
SELECT
  u.id,
  u.acorn_balance - COALESCE(t.total, 0),
  'LEDGER_RECONCILE',
  'ledger_reconcile',
  u.id,
  '원장 누락분 소급 기록 (온보딩 보상 등)'
FROM app_users u
LEFT JOIN (
  SELECT user_id, SUM(amount) AS total
    FROM user_acorn_transactions
   GROUP BY user_id
) t ON t.user_id = u.id
WHERE u.acorn_balance <> COALESCE(t.total, 0);

-- 3) 검증 — 남은 불일치가 있으면 실패시킨다.
--    (여기서 통과해야 다음 마이그레이션의 행사 귀속이 안전하다)
DO $$
DECLARE
  n int;
BEGIN
  SELECT COUNT(*) INTO n
    FROM app_users u
    LEFT JOIN (
      SELECT user_id, SUM(amount) AS total
        FROM user_acorn_transactions
       GROUP BY user_id
    ) t ON t.user_id = u.id
   WHERE u.acorn_balance <> COALESCE(t.total, 0);
  IF n > 0 THEN
    RAISE EXCEPTION '원장 보정 실패 — 여전히 % 명 불일치', n;
  END IF;
  RAISE NOTICE '✔ 잔액 = 원장 합계 (전원 일치)';
END $$;

NOTIFY pgrst, 'reload schema';
