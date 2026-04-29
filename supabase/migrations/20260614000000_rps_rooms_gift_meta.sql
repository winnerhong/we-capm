-- ============================================================================
-- Migration: 20260614000000_rps_rooms_gift_meta.sql
-- Purpose : rps_rooms 에 선물 메타(이름/이미지/메시지) 추가.
--           새 게임 시작 시점에 호스트가 미리 입력 → 게임 종료 시 자동 사용.
-- Notes   : Idempotent (IF NOT EXISTS). RLS 변경 없음 — 기존 정책 그대로.
-- ============================================================================

ALTER TABLE rps_rooms
  ADD COLUMN IF NOT EXISTS gift_label     text NULL,
  ADD COLUMN IF NOT EXISTS gift_image_url text NULL,
  ADD COLUMN IF NOT EXISTS gift_message   text NULL;
