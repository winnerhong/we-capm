-- ============================================================================
-- Migration: 20260725000000_event_invitation_images.sql
-- Purpose : 초대장 행사장 사진 컬럼 추가.
--           - invitation_location_image_url : 행사장 안내 이미지 (입구·간판 등)
--           주차장 사진은 invitation_parkings JSON 안의 image_url 필드로 저장
--           (스키마 변경 불필요).
-- ============================================================================

ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS invitation_location_image_url text NULL;

COMMENT ON COLUMN org_events.invitation_location_image_url
  IS '초대장 행사장 안내 이미지 URL — Supabase Storage public URL. 비우면 초대장에 노출 안 함.';

-- ============================================================================
-- End of migration 20260725000000_event_invitation_images.sql
-- ============================================================================
