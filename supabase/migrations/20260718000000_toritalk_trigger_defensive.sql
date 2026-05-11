-- ============================================================================
-- Migration: 20260718000000_toritalk_trigger_defensive.sql
-- Purpose : profile_photo_url 자동 갱신 트리거를 완전 방어적으로 — 어떤 예외도
--           parent transaction(mission_submissions INSERT) 에 영향 X.
-- Why     : 트리거 본문 어디서든 예외 발생 시 INSERT 가 롤백되어 미션 제출
--           자체가 실패하던 케이스 (e.g. profile_photo_url 컬럼 누락,
--           RLS 정책 충돌, app_users 행 부재 등)를 silent fail 로 전환.
-- ============================================================================

CREATE OR REPLACE FUNCTION trg_toritalk_profile_photo_from_submission()
RETURNS TRIGGER AS $$
DECLARE
  v_kind        text;
  v_first_url   text;
BEGIN
  -- 전체 본문을 EXCEPTION 핸들러로 감싸 어떤 에러도 swallow.
  BEGIN
    SELECT kind INTO v_kind
      FROM org_missions
     WHERE id = NEW.org_mission_id;

    IF v_kind IS DISTINCT FROM 'PHOTO' THEN
      RETURN NEW;
    END IF;

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

    -- 컬럼이 없거나 RLS 충돌이면 OTHERS 핸들러로 잡힘 → NEW 그대로 반환
    UPDATE app_users
       SET profile_photo_url = v_first_url
     WHERE id = NEW.user_id
       AND (profile_photo_url IS NULL OR profile_photo_url = '');

  EXCEPTION WHEN OTHERS THEN
    -- 어떤 예외든 무시 — submission INSERT 는 정상 완료되어야 함.
    NULL;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
