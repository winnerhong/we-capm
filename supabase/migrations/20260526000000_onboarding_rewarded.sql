-- ============================================================================
-- Migration: 20260526000000_onboarding_rewarded.sql
-- Purpose : 참가자 첫 프로필 완성 시 도토리 1개 지급 — 중복 방지 플래그
--           true 로 바뀐 뒤로는 재완료해도 재지급 없음.
-- ============================================================================

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS onboarding_rewarded boolean NOT NULL DEFAULT false;

-- 실행 후: NOTIFY pgrst, 'reload schema';
