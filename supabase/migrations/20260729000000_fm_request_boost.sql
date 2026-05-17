-- 토리FM 신청곡 경매(boost) — 청취자가 도토리를 추가 지불해서
-- 자기/타인의 신청곡을 상위로 끌어올리는 기능.
--
-- 데이터 모델:
--   tori_fm_requests.boost_amount  : 누적 boost 도토리 (default 0)
--   tori_fm_requests.last_boost_at : 마지막 boost 시각 (정렬 tiebreaker)
--   tori_fm_boosts                 : boost ledger (환불 근거)
--
-- 정렬 키 (UI 'boost' 모드):
--   ORDER BY boost_amount DESC, last_boost_at DESC
--
-- 환불 정책:
--   HIDDEN/REJECTED 처리 시 tori_fm_boosts 의 CHARGE 합계만큼 user 도토리 복구.
--   복구 후 boost_amount=0, last_boost_at=null 로 리셋.

-- ------------------------------------------------------------
-- 1) tori_fm_requests 컬럼 추가
-- ------------------------------------------------------------
ALTER TABLE public.tori_fm_requests
  ADD COLUMN IF NOT EXISTS boost_amount integer NOT NULL DEFAULT 0
    CHECK (boost_amount >= 0),
  ADD COLUMN IF NOT EXISTS last_boost_at timestamptz;

-- 정렬용 인덱스 — 세션 안에서 boost_amount DESC 즉시 조회
CREATE INDEX IF NOT EXISTS idx_fm_requests_session_boost
  ON public.tori_fm_requests(session_id, boost_amount DESC, last_boost_at DESC);

-- ------------------------------------------------------------
-- 2) tori_fm_boosts ledger
--    kind='CHARGE' : 청취자가 boost 지불
--    kind='REFUND' : 모더레이션 (HIDDEN/REJECTED) 시 환불
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.tori_fm_boosts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.tori_fm_requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.app_users(id),
  kind text NOT NULL DEFAULT 'CHARGE' CHECK (kind IN ('CHARGE', 'REFUND')),
  amount integer NOT NULL CHECK (amount > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fm_boosts_request
  ON public.tori_fm_boosts(request_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fm_boosts_user
  ON public.tori_fm_boosts(user_id, created_at DESC);

-- Phase 0 RLS (permissive — 다른 토리FM 테이블과 동일)
ALTER TABLE public.tori_fm_boosts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "tori_fm_boosts_all" ON public.tori_fm_boosts;
CREATE POLICY "tori_fm_boosts_all" ON public.tori_fm_boosts
  FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- 3) user_acorn_transactions.reason CHECK 제약 영구 제거
--    원래는 확장 리스트로 ADD 했지만, 이후 FM_HEART / FM_CHEER_* 등
--    추가될 때마다 마이그레이션이 필요했고 production 데이터가 매번
--    23514 로 막힘. application 코드(AcornReason union) 가 enum 통제
--    중이므로 DB 레벨 CHECK 제거로 단순화.
-- ------------------------------------------------------------
ALTER TABLE public.user_acorn_transactions
  DROP CONSTRAINT IF EXISTS user_acorn_transactions_reason_check;
