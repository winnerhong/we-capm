-- ============================================================================
-- Migration: 20260714000000_toritalk.sql
-- Purpose : 토리톡(Toritalk) 정식 출시 — 기관별 활성화 + 방(반) 단위 채팅 + 가족사진 프로필
-- Notes   :
--   - partner_orgs.toritalk_enabled  : 기관 단위 활성화 토글(default false)
--   - app_users.profile_photo_url    : 채팅 프로필 사진 (가족사진 미션에서 자동 채움)
--   - toritalk_rooms                 : "반" 단위 채팅방 (max_members default 35)
--   - toritalk_room_members          : 방 ↔ app_user N:M (last_read_at 포함)
--   - toritalk_messages              : 메시지 (Realtime publication 추가)
--   - RLS 정책은 Phase 0 패턴(permissive) — 서버 액션 레이어에서 권한 검증.
--   - 멱등 (IF NOT EXISTS / DROP POLICY IF EXISTS) — 재실행 안전.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) partner_orgs: 토리톡 활성화 플래그
-- ---------------------------------------------------------------------------
ALTER TABLE partner_orgs
  ADD COLUMN IF NOT EXISTS toritalk_enabled boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN partner_orgs.toritalk_enabled
  IS '기관에서 토리톡을 활성화했는지. false면 참가자에게 토리톡 메뉴/페이지가 노출되지 않음.';


-- ---------------------------------------------------------------------------
-- 2) app_users: 프로필 사진 URL
-- ---------------------------------------------------------------------------
ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS profile_photo_url text;

COMMENT ON COLUMN app_users.profile_photo_url
  IS '채팅·관제 등에서 사용할 프로필 사진. "우리가족 사진찍기" 미션 제출 시 자동 갱신.';


-- ---------------------------------------------------------------------------
-- 3) toritalk_rooms : "반" 단위 채팅방
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS toritalk_rooms (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  name          text NOT NULL,
  description   text,
  max_members   int NOT NULL DEFAULT 35 CHECK (max_members BETWEEN 2 AND 200),
  archived      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_toritalk_rooms_org
  ON toritalk_rooms(org_id, archived);

COMMENT ON TABLE toritalk_rooms IS '토리톡 채팅방. 보통 1방 = 1반(35명 cap). 기관 admin이 만듦.';

-- updated_at 자동 갱신
CREATE OR REPLACE FUNCTION trg_toritalk_rooms_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS toritalk_rooms_touch_updated_at ON toritalk_rooms;
CREATE TRIGGER toritalk_rooms_touch_updated_at
  BEFORE UPDATE ON toritalk_rooms
  FOR EACH ROW EXECUTE FUNCTION trg_toritalk_rooms_touch_updated_at();

ALTER TABLE toritalk_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "toritalk_rooms_all" ON toritalk_rooms;
CREATE POLICY "toritalk_rooms_all" ON toritalk_rooms
  FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 4) toritalk_room_members : 방 ↔ app_user (N:M)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS toritalk_room_members (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id       uuid NOT NULL REFERENCES toritalk_rooms(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  role          text NOT NULL DEFAULT 'MEMBER'
                  CHECK (role IN ('MEMBER','ADMIN')),
  joined_at     timestamptz NOT NULL DEFAULT now(),
  last_read_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(room_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_toritalk_room_members_room
  ON toritalk_room_members(room_id);
CREATE INDEX IF NOT EXISTS idx_toritalk_room_members_user
  ON toritalk_room_members(user_id);

COMMENT ON TABLE toritalk_room_members IS '방 멤버. last_read_at로 unread 카운트 계산.';

ALTER TABLE toritalk_room_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "toritalk_room_members_all" ON toritalk_room_members;
CREATE POLICY "toritalk_room_members_all" ON toritalk_room_members
  FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 5) toritalk_messages : 메시지
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS toritalk_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id         uuid NOT NULL REFERENCES toritalk_rooms(id) ON DELETE CASCADE,
  sender_user_id  uuid REFERENCES app_users(id) ON DELETE SET NULL,
  content         text NOT NULL CHECK (length(content) BETWEEN 1 AND 2000),
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_toritalk_messages_room_created
  ON toritalk_messages(room_id, created_at DESC);

COMMENT ON TABLE toritalk_messages IS '토리톡 메시지(텍스트). 사용자 삭제 시 sender_user_id=NULL로 두고 메시지는 유지.';

ALTER TABLE toritalk_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "toritalk_messages_all" ON toritalk_messages;
CREATE POLICY "toritalk_messages_all" ON toritalk_messages
  FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- 6) Realtime publication : 메시지 INSERT 구독을 위해 추가
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime'
       AND schemaname = 'public'
       AND tablename = 'toritalk_messages'
  ) THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE toritalk_messages';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 7) 가족사진 자동 프로필 — mission_submissions PHOTO 제출 시 갱신
--    트리거: INSERT 시 payload_json->'photo_urls' 의 첫 URL을 app_users.profile_photo_url에 저장.
--    조건: 해당 org_mission이 PHOTO 종류이고, profile_photo_url 이 비어있을 때만.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION trg_toritalk_profile_photo_from_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_kind        text;
  v_first_url   text;
BEGIN
  -- 1) 미션 종류 확인
  SELECT kind INTO v_kind
    FROM org_missions
   WHERE id = NEW.org_mission_id;

  IF v_kind IS DISTINCT FROM 'PHOTO' THEN
    RETURN NEW;
  END IF;

  -- 2) payload_json->'photo_urls' 의 첫 번째 항목 추출
  BEGIN
    v_first_url := NEW.payload_json->'photo_urls'->>0;
  EXCEPTION WHEN OTHERS THEN
    v_first_url := NULL;
  END;

  IF v_first_url IS NULL OR length(v_first_url) = 0 THEN
    RETURN NEW;
  END IF;

  IF NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- 3) profile_photo_url 갱신 (이미 있으면 덮어쓰지 않고 NULL일 때만 채움)
  UPDATE app_users
     SET profile_photo_url = v_first_url
   WHERE id = NEW.user_id
     AND (profile_photo_url IS NULL OR profile_photo_url = '');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 트리거 부착 — mission_submissions 테이블이 존재할 때만
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='mission_submissions'
  ) THEN
    DROP TRIGGER IF EXISTS toritalk_profile_photo_from_submission ON mission_submissions;
    CREATE TRIGGER toritalk_profile_photo_from_submission
      AFTER INSERT ON mission_submissions
      FOR EACH ROW EXECUTE FUNCTION trg_toritalk_profile_photo_from_submission();
  ELSE
    RAISE NOTICE 'mission_submissions 없음 — 프로필 사진 트리거 건너뜀';
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 7-b) 일회성 백필 — 기존에 들어온 PHOTO 제출들에서 첫 가족사진을 끌어오기
--      이미 profile_photo_url 이 있는 사용자는 건드리지 않음.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema='public' AND table_name='mission_submissions'
  ) THEN
    WITH first_photos AS (
      SELECT DISTINCT ON (s.user_id)
             s.user_id,
             s.payload_json->'photo_urls'->>0 AS first_url
        FROM mission_submissions s
        JOIN org_missions m ON m.id = s.org_mission_id
       WHERE m.kind = 'PHOTO'
         AND s.payload_json ? 'photo_urls'
         AND jsonb_array_length(COALESCE(s.payload_json->'photo_urls', '[]'::jsonb)) > 0
       ORDER BY s.user_id, s.submitted_at ASC
    )
    UPDATE app_users u
       SET profile_photo_url = fp.first_url
      FROM first_photos fp
     WHERE u.id = fp.user_id
       AND (u.profile_photo_url IS NULL OR u.profile_photo_url = '')
       AND fp.first_url IS NOT NULL
       AND length(fp.first_url) > 0;
  END IF;
END $$;


-- ---------------------------------------------------------------------------
-- 8) PostgREST 스키마 캐시 리로드
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
