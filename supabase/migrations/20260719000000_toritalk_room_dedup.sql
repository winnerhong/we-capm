-- ============================================================================
-- Migration: 20260719000000_toritalk_room_dedup.sql
-- Purpose : 같은 이름의 토리톡 방이 여러 개 생기던 버그 fix.
--           1) 기존 중복 방 병합 (멤버·메시지 이전 후 잉여 방 삭제)
--           2) (org_id, normalized name) 부분 unique 인덱스로 신규 중복 차단
--           3) RPC toritalk_ensure_room_membership 을 UNIQUE 충돌 race-safe 로 갱신
--           4) PostgREST 스키마 리로드
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) 기존 중복 병합
--    같은 org_id + 같은 normalized name 의 archived=false 방들을 가장 오래된
--    방으로 합친다. 멤버는 idempotent (room_id, user_id) ON CONFLICT DO NOTHING,
--    메시지는 room_id 만 옮긴다. 마지막에 잉여 방 삭제.
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r_dup record;
BEGIN
  FOR r_dup IN
    SELECT
      org_id,
      NULLIF(lower(btrim(name)), '') AS norm_name,
      (array_agg(id ORDER BY created_at ASC, id ASC))[1] AS canonical_id,
      array_agg(id ORDER BY created_at ASC, id ASC) AS all_ids
      FROM toritalk_rooms
     WHERE archived = false
       AND NULLIF(lower(btrim(name)), '') IS NOT NULL
     GROUP BY org_id, NULLIF(lower(btrim(name)), '')
    HAVING count(*) > 1
  LOOP
    -- 멤버 이전 (중복 row_id 는 ON CONFLICT skip)
    UPDATE toritalk_room_members m
       SET room_id = r_dup.canonical_id
     WHERE m.room_id = ANY(r_dup.all_ids)
       AND m.room_id <> r_dup.canonical_id
       AND NOT EXISTS (
         SELECT 1 FROM toritalk_room_members x
          WHERE x.room_id = r_dup.canonical_id
            AND x.user_id = m.user_id
       );

    -- 위에서 옮기지 못한 중복 멤버 row 삭제
    DELETE FROM toritalk_room_members m
     WHERE m.room_id = ANY(r_dup.all_ids)
       AND m.room_id <> r_dup.canonical_id;

    -- 메시지 이전
    UPDATE toritalk_messages
       SET room_id = r_dup.canonical_id
     WHERE room_id = ANY(r_dup.all_ids)
       AND room_id <> r_dup.canonical_id;

    -- 잉여 방 삭제
    DELETE FROM toritalk_rooms
     WHERE id = ANY(r_dup.all_ids)
       AND id <> r_dup.canonical_id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- 2) (org_id, normalized name) 부분 unique 인덱스
--    archived=false 인 방들 사이에서만 unique — 보관함의 옛 이름은 허용.
--    NULLIF 로 빈 이름은 인덱스 대상에서 제외.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_toritalk_rooms_active_norm
  ON toritalk_rooms(org_id, NULLIF(lower(btrim(name)), ''))
  WHERE archived = false;


-- ---------------------------------------------------------------------------
-- 3) RPC toritalk_ensure_room_membership — race-safe 버전
--    동시에 두 호출이 lookup → 둘 다 NULL → 둘 다 INSERT 하던 문제를
--    INSERT ... ON CONFLICT 로 흡수하고, 충돌 시 기존 row 를 재조회.
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

  IF v_normalized IS NULL THEN
    RETURN NULL;
  END IF;
  IF p_user_id IS NULL OR p_org_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT toritalk_enabled INTO v_enabled
    FROM partner_orgs
   WHERE id = p_org_id;
  IF NOT COALESCE(v_enabled, false) THEN
    RETURN NULL;
  END IF;

  -- 기존 active 방 lookup
  SELECT id, max_members
    INTO v_room_id, v_max
    FROM toritalk_rooms
   WHERE org_id = p_org_id
     AND archived = false
     AND NULLIF(lower(btrim(name)), '') = v_normalized
   ORDER BY created_at ASC
   LIMIT 1;

  -- 없으면 생성 — UNIQUE 인덱스(uq_toritalk_rooms_active_norm) 가 있으므로
  -- 동시 호출이 둘 다 도달해도 한쪽은 23505 충돌. 충돌 시 재조회로 흡수.
  IF v_room_id IS NULL THEN
    BEGIN
      INSERT INTO toritalk_rooms (org_id, name, max_members)
      VALUES (p_org_id, v_clean_name, 35)
      RETURNING id, max_members INTO v_room_id, v_max;
    EXCEPTION WHEN unique_violation THEN
      SELECT id, max_members
        INTO v_room_id, v_max
        FROM toritalk_rooms
       WHERE org_id = p_org_id
         AND archived = false
         AND NULLIF(lower(btrim(name)), '') = v_normalized
       ORDER BY created_at ASC
       LIMIT 1;
    END;
  END IF;

  -- 이미 멤버면 idempotent
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
    RETURN NULL;
  END IF;

  INSERT INTO toritalk_room_members (room_id, user_id, role)
  VALUES (v_room_id, p_user_id, 'MEMBER')
  ON CONFLICT (room_id, user_id) DO NOTHING;

  RETURN v_room_id;
END;
$$;


-- ---------------------------------------------------------------------------
-- 4) PostgREST schema reload
-- ---------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
