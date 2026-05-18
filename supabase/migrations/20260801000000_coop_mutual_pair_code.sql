-- ============================================================
-- 협동 미션 — 양방향 페어 코드 교환
--
-- 기존: A 가 코드 발급 → B 가 입력 → 즉시 PAIRED (단방향)
-- 변경: A 코드 발급 → B 입력 (이때 B 코드 자동 발급) → A 가 B 코드 확인 → PAIRED
--
-- 새 컬럼:
--   partner_pair_code               : B 가 합류 시점에 자동 발급한 코드
--   initiator_confirmed_partner_at  : A 가 B 코드 확인 완료 시각
--
-- 새 state:
--   WAITING_RECIPROCAL : B 합류 후 A 의 확인 대기 (양방향 교환 중간 단계)
-- ============================================================

ALTER TABLE public.mission_coop_sessions
  ADD COLUMN IF NOT EXISTS partner_pair_code text NULL,
  ADD COLUMN IF NOT EXISTS initiator_confirmed_partner_at timestamptz NULL;

-- state CHECK 확장.
-- 기존 production 데이터(A_DONE/B_DONE 등) 호환 위해 모든 값 포함.
ALTER TABLE public.mission_coop_sessions
  DROP CONSTRAINT IF EXISTS mission_coop_sessions_state_check;

ALTER TABLE public.mission_coop_sessions
  ADD CONSTRAINT mission_coop_sessions_state_check
  CHECK (state IN (
    'WAITING',
    'WAITING_RECIPROCAL',
    'PAIRED',
    'A_DONE',
    'B_DONE',
    'COMPLETED',
    'EXPIRED',
    'CANCELLED'
  ));

-- partner_pair_code 도 활성 세션 안에서 unique 보장 (A 의 pair_code 와 같은 이유).
-- WAITING/WAITING_RECIPROCAL/PAIRED 만 충돌 검사 — 종료 상태 row 는 무시.
CREATE UNIQUE INDEX IF NOT EXISTS idx_coop_sessions_partner_code_active
  ON public.mission_coop_sessions(partner_pair_code)
  WHERE state IN ('WAITING','WAITING_RECIPROCAL','PAIRED')
    AND partner_pair_code IS NOT NULL;

COMMENT ON COLUMN public.mission_coop_sessions.partner_pair_code
  IS 'B 측(partner) 이 합류 시점에 자동 발급받는 4자리 코드. A 가 입력해야 PAIRED 전이.';
COMMENT ON COLUMN public.mission_coop_sessions.initiator_confirmed_partner_at
  IS 'A 가 B 코드 입력 완료 시각. NULL 이면 양방향 교환 아직 미완료.';
