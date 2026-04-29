-- ============================================================================
-- Migration: 20260613000000_user_gifts.sql
-- Purpose : 사용자 선물함 — 다양한 출처(rps 우승, 수동발급, 미션보상, 추첨)에서
--           발급된 쿠폰 기프티콘을 한 곳에 모아 보여주고, QR 스캔으로 매장 수령.
-- Depends : app_users, partner_orgs (소프트 참조 — FK 없음, 도메인 간 결합도 최소화)
-- Notes   : Fully idempotent. Phase 0 permissive RLS (TODO: tighten in Phase 1).
--           Realtime 활성화: REPLICA IDENTITY FULL + supabase_realtime publication.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) user_gifts — 사용자 선물함
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_gifts (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL,
  org_id        uuid NOT NULL,
  source_type   text NOT NULL
                  CHECK (source_type IN ('rps_winner','manual_grant','mission_reward','event_lottery')),
  source_id     uuid NULL,
  display_name  text NOT NULL,
  gift_label    text NOT NULL,
  gift_url      text NULL,
  message       text NULL,
  coupon_code   text NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','redeemed','expired','cancelled')),
  granted_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NULL,
  redeemed_at   timestamptz NULL,
  redeemed_by   uuid NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
-- 사용자 선물함 조회 (본인 받은 선물 목록, 최신순)
CREATE INDEX IF NOT EXISTS idx_user_gifts_user_status_granted
  ON user_gifts (user_id, status, granted_at DESC);

-- 기관 발급 현황 (org 관제실에서 본 발급 목록)
CREATE INDEX IF NOT EXISTS idx_user_gifts_org_status_granted
  ON user_gifts (org_id, status, granted_at DESC);

-- 출처별 조회 (예: 특정 rps_room 의 발급 내역 일괄 조회)
CREATE INDEX IF NOT EXISTS idx_user_gifts_source
  ON user_gifts (source_type, source_id);

-- coupon_code 는 UNIQUE 제약이 자동 인덱스를 만들어 별도 인덱스 불필요.

-- ---------------------------------------------------------------------------
-- RLS — Phase 0 permissive
-- ---------------------------------------------------------------------------
ALTER TABLE user_gifts ENABLE ROW LEVEL SECURITY;

-- TODO(phase1):
--   SELECT : auth.uid() = user_id (본인) OR 같은 org staff/admin
--   INSERT : 같은 org staff/admin 만 (또는 서비스 롤로 시스템 발급)
--   UPDATE : status='redeemed' 전이는 같은 org staff/admin 만 (redeemed_at, redeemed_by 기록)
--   DELETE : admin 만 (감사 추적 위해 기본 금지)
DROP POLICY IF EXISTS "user_gifts_all" ON user_gifts;
CREATE POLICY "user_gifts_all" ON user_gifts
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Realtime: REPLICA IDENTITY FULL + supabase_realtime publication
-- (publication ADD 는 IF NOT EXISTS 미지원 → DO 블록으로 예외 흡수)
-- ---------------------------------------------------------------------------
ALTER TABLE user_gifts REPLICA IDENTITY FULL;

DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE user_gifts;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

-- ============================================================================
-- End of migration 20260613000000_user_gifts.sql
-- ============================================================================
