-- ============================================================================
-- Migration: 20260717000000_toritalk_message_edit_delete.sql
-- Purpose : 토리톡 메시지 수정/삭제 — soft delete + 수정 시각 표시
-- Notes   :
--   - edited_at  : 수정된 메시지의 마지막 수정 시각. NULL=원본.
--   - deleted_at : 소프트 삭제 시각. NULL=정상. NOT NULL이면 content="" 처리.
--   - 둘 다 nullable. 멱등 (IF NOT EXISTS).
-- ============================================================================

ALTER TABLE toritalk_messages
  ADD COLUMN IF NOT EXISTS edited_at  timestamptz,
  ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

COMMENT ON COLUMN toritalk_messages.edited_at
  IS '메시지가 수정된 마지막 시각. NULL이면 원본 그대로.';
COMMENT ON COLUMN toritalk_messages.deleted_at
  IS '소프트 삭제 시각. NOT NULL이면 클라이언트에서 "삭제된 메시지" 로 표시.';

CREATE INDEX IF NOT EXISTS idx_toritalk_messages_room_not_deleted
  ON toritalk_messages(room_id, created_at DESC)
  WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';
