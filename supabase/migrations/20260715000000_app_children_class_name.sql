-- ============================================================================
-- Migration: 20260715000000_app_children_class_name.sql
-- Purpose : 자녀(원생)별 "반(class)" 정보 추가 + 토리톡 자동 가입 RPC
-- Notes   :
--   - app_children.class_name        : "토끼반", "곰반" 등 자유 입력
--   - app_children.class_name_normalized (GENERATED) : lower(btrim(class_name))
--     공백/대소문자 무시한 매칭용. NULL/빈문자 → NULL.
--   - RPC toritalk_ensure_room_membership(p_org_id, p_class_name, p_user_id):
--     1) 정규화한 이름으로 룸 lookup
--     2) 없으면 생성(max_members=35)
--     3) 정원 체크 후 멤버 추가 (이미 멤버면 idempotent)
--     4) 토리톡 비활성 기관이면 NULL 반환
--   - RPC toritalk_backfill_classnames(p_org_id):
--     기존 class_name 이 채워진 자녀들의 보호자를 일괄 가입
--   - RLS Phase 0 permissive 패턴 유지.
--   - 멱등 (IF NOT EXISTS / CREATE OR REPLACE) — 재실행 안전.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) app_children: class_name 컬럼 + 정규화 generated 컬럼
-- ---------------------------------------------------------------------------
ALTER TABLE app_children
  ADD COLUMN IF NOT EXISTS class_name text;

COMMENT ON COLUMN app_children.class_name
  IS '자녀의 반(예: 토끼반). NULL 허용. 토리톡 활성 시 같은 normalized 이름의 방에 보호자 자동 가입.';

-- generated 컬럼은 immutable 함수만 허용 — lower/btrim/NULLIF 모두 immutable.
-- 이미 컬럼이 존재할 수 있어 DO 블록으로 가드.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema='public'
       AND table_name='app_children'
       AND column_name='class_name_normalized'
  ) THEN
    ALTER TABLE app_children
      ADD COLUMN class_name_normalized text
        GENERATED ALWAYS AS (NULLIF(lower(btrim(class_name)), '')) STORED;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_app_children_class_norm
  ON app_children(class_name_normalized)
  WHERE class_name_normalized IS NOT NULL;


-- ---------------------------------------------------------------------------
-- 2) toritalk_rooms 의 name 도 정규화 보조 인덱스(이미 있는 데이터에 영향 X)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_toritalk_rooms_org_name_norm
  ON toritalk_rooms(org_id, (NULLIF(lower(btrim(name)), '')))
  WHERE archived = false;


-- ---------------------------------------------------------------------------
-- 3) RPC: 보호자를 class_name 매칭 방에 자동 가입
--    반환: 가입된 room_id (skip/실패 시 NULL)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION toritalk_ensure_room_membership(
  p_org_id      uuid,
  p_class_name  text,
  p_user_id     uuid
) RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_normalized   text;
  v_clean_name   text;
  v_room_id      uuid;
  v_max          int;
  v_current      int;
  v_enabled      boolean;
BEGIN
  v_clean_name := btrim(coalesce(p_class_name, ''));
  v_normalized := NULLIF(lower(v_clean_name), '');

  -- 빈 반명이면 skip
  IF v_normalized IS NULL THEN
    RETURN NULL;
  END IF;

  -- user_id / org_id 유효성
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 기관 토리톡 활성화 여부
  SELECT toritalk_enabled INTO v_enabled
    FROM partner_orgs
   WHERE id = p_org_id;
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NULL;
  END IF;

  -- 룸 찾기 (정규화 비교, archived=false)
  SELECT id, max_members
    INTO v_room_id, v_max
    FROM toritalk_rooms
   WHERE org_id = p_org_id
     AND archived = false
     AND NULLIF(lower(btrim(name)), '') = v_normalized
   ORDER BY created_at ASC
   LIMIT 1;

  -- 없으면 새로 생성 (원본 이름 trim 해서 저장)
  IF v_room_id IS NULL THEN
    INSERT INTO toritalk_rooms (org_id, name, max_members)
    VALUES (p_org_id, v_clean_name, 35)
    RETURNING id, max_members INTO v_room_id, v_max;
  END IF;

  -- 이미 멤버면 idempotent return
  IF EXISTS (
    SELECT 1 FROM toritalk_room_members
     WHERE room_id = v_room_id AND user_id = p_user_id
  ) THEN
    RETURN v_room_id;
  END IF;

  -- 정원 체크
  SELECT count(*) INTO v_current
    FROM toritalk_room_members
   WHERE room_id = v_room_id;

  IF v_current >= v_max THEN
    -- 정원 초과 — silent skip, 룸 id 는 반환하지 않음
    RETURN NULL;
  END IF;

  -- 멤버 추가
  INSERT INTO toritalk_room_members (room_id, user_id, role)
  VALUES (v_room_id, p_user_id, 'MEMBER')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room_id;
END;
$$;

COMMENT ON FUNCTION toritalk_ensure_room_membership(uuid, text, uuid)
  IS '자녀 반명으로 토리톡 방을 찾거나 생성하고, 보호자를 그 방의 멤버로 추가. 비활성/정원초과/빈반명 시 NULL.';


-- ---------------------------------------------------------------------------
-- 4) RPC: 기관 전체 백필 — 기존 class_name 데이터로 방 자동 생성/가입
--    토리톡 활성화 직후 호출하면 누락된 자녀들의 보호자가 일괄 가입됨.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION toritalk_backfill_classnames(p_org_id uuid)
RETURNS TABLE(rooms_created int, members_added int)
LANGUAGE plpgsql
AS $$
DECLARE
  r_record       record;
  v_before_rooms int;
  v_after_rooms  int;
  v_before_mem   int;
  v_after_mem    int;
  v_room_id      uuid;
BEGIN
  SELECT count(*) INTO v_before_rooms FROM toritalk_rooms WHERE org_id = p_org_id;
  SELECT count(*) INTO v_before_mem
    FROM toritalk_room_members m
    JOIN toritalk_rooms r ON r.id = m.room_id
   WHERE r.org_id = p_org_id;

  FOR r_record IN
    SELECT DISTINCT c.class_name, u.id AS user_id
      FROM app_children c
      JOIN app_users u ON u.id = c.user_id
     WHERE u.org_id = p_org_id
       AND c.class_name_normalized IS NOT NULL
  LOOP
    v_room_id := toritalk_ensure_room_membership(p_org_id, r_record.class_name, r_record.user_id);
  END LOOP;

  SELECT count(*) INTO v_after_rooms FROM toritalk_rooms WHERE org_id = p_org_id;
  SELECT count(*) INTO v_after_mem
    FROM toritalk_room_members m
    JOIN toritalk_rooms r ON r.id = m.room_id
   WHERE r.org_id = p_org_id;

  rooms_created := v_after_rooms - v_before_rooms;
  members_added := v_after_mem - v_before_mem;
  RETURN NEXT;
END;
$$;

COMMENT ON FUNCTION toritalk_backfill_classnames(uuid)
  IS '기관의 모든 자녀 class_name 으로 토리톡 방/멤버를 일괄 생성. 토리톡 활성화 후 호출.';


-- ---------------------------------------------------------------------------
-- 5) PostgREST 스키마 캐시 리로드 — 새 RPC/컬럼 인식
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
