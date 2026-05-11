-- ============================================================================
-- Migration: 20260716000000_toritalk_policy_and_admin.sql
-- Purpose : 토리톡 방 정책(노출/셀프입장) + 기관 admin 시스템 메시지 발신
-- Notes   :
--   - toritalk_rooms.is_listed         : 비멤버에게 방 목록 노출 여부 (default true)
--   - toritalk_rooms.allow_self_join   : 비멤버 셀프 입장 허용 (default false)
--     · listed=F + join=T 조합은 UI 에서 차단 (의미 모순)
--   - toritalk_messages.sender_org_id  : 기관 admin 발신 메시지 (sender_user_id 와 XOR)
--   - 시스템 메시지(둘 다 NULL)도 허용 — 향후 확장용
--   - 멱등 (IF NOT EXISTS) + 재실행 안전
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) toritalk_rooms : 정책 컬럼 2개
-- ---------------------------------------------------------------------------
ALTER TABLE toritalk_rooms
  ADD COLUMN IF NOT EXISTS is_listed       boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_self_join boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN toritalk_rooms.is_listed
  IS '비멤버에게 "다른 방 둘러보기" 목록에 노출할지. false면 멤버만 알고 있음.';
COMMENT ON COLUMN toritalk_rooms.allow_self_join
  IS '비멤버가 목록에서 직접 입장 가능. false면 기관 admin 초대만 가입.';

CREATE INDEX IF NOT EXISTS idx_toritalk_rooms_org_listed
  ON toritalk_rooms(org_id, is_listed)
  WHERE archived = false;


-- ---------------------------------------------------------------------------
-- 2) toritalk_messages : 기관 admin 발신용 sender_org_id
-- ---------------------------------------------------------------------------
ALTER TABLE toritalk_messages
  ADD COLUMN IF NOT EXISTS sender_org_id uuid REFERENCES partner_orgs(id) ON DELETE SET NULL;

COMMENT ON COLUMN toritalk_messages.sender_org_id
  IS '기관 운영자가 보낸 메시지인 경우 기관 id. sender_user_id 와 동시 NOT NULL 불가.';

-- XOR-ish 제약 — 양쪽 다 not null 인 케이스만 차단 (양쪽 다 null 인 시스템 메시지는 허용)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'toritalk_messages_sender_xor_chk'
  ) THEN
    ALTER TABLE toritalk_messages
      ADD CONSTRAINT toritalk_messages_sender_xor_chk
      CHECK (NOT (sender_user_id IS NOT NULL AND sender_org_id IS NOT NULL));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_toritalk_messages_room_sender_org
  ON toritalk_messages(room_id, sender_org_id)
  WHERE sender_org_id IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 3) PostgREST 스키마 캐시 리로드
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
