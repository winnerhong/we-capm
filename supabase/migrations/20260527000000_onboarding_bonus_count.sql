-- ============================================================================
-- Migration: 20260527000000_onboarding_bonus_count.sql
-- Purpose : 온보딩 형제/자매 추가 보너스 지급 횟수 추적.
--           총 지급 가능 도토리 = 1 (기본) + 2 (보너스) = 3개 상한.
-- ============================================================================

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS onboarding_bonus_count integer NOT NULL DEFAULT 0;

-- 실행 후: NOTIFY pgrst, 'reload schema';
