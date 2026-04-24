-- ============================================================================
-- Migration: 20260529000000_first_mission_family_photo.sql
-- Purpose : "우리가족 사진찍기!" 를 참가자 스탬프북의 첫 번째 미션으로 구성.
--           기존 "가족 사진..." 제목의 미션이 있으면 업데이트, 없으면 INSERT.
--
-- 결과:
--   - kind = PHOTO
--   - acorns = 1  (완료 시 도토리 +1)
--   - display_order = 1  (첫 번째)
--   - approval_mode = AUTO  (제출 즉시 AUTO_APPROVED → 도토리 지급)
--   - unlock_rule = ALWAYS
--   - is_active = true
--   - 속한 pack 은 LIVE 상태
-- ============================================================================

DO $$
DECLARE
  v_pack_id uuid;
  v_org_id uuid;
  v_existing_id uuid;
BEGIN
  -- 1) 대상 pack 선정 — 가장 최근 LIVE. 없으면 가장 최근 DRAFT 를 LIVE 로 승격.
  SELECT id, org_id INTO v_pack_id, v_org_id
  FROM org_quest_packs
  WHERE status = 'LIVE'
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_pack_id IS NULL THEN
    SELECT id, org_id INTO v_pack_id, v_org_id
    FROM org_quest_packs
    WHERE status = 'DRAFT'
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_pack_id IS NOT NULL THEN
      UPDATE org_quest_packs
      SET status = 'LIVE', updated_at = now()
      WHERE id = v_pack_id;
    END IF;
  END IF;

  IF v_pack_id IS NULL THEN
    RAISE NOTICE '[first_mission_family_photo] 적용 가능한 quest pack 이 없어 스킵';
    RETURN;
  END IF;

  -- 2) 기존 "가족 사진" 패턴 미션 찾기
  SELECT id INTO v_existing_id
  FROM org_missions
  WHERE quest_pack_id = v_pack_id
    AND (
      title ILIKE '%가족 사진%'
      OR title ILIKE '%가족사진%'
      OR title = '우리가족 사진찍기!'
    )
  ORDER BY display_order ASC
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    -- UPDATE
    UPDATE org_missions
    SET
      title         = '우리가족 사진찍기!',
      description   = '가족 모두가 함께 찍은 사진을 올려주세요',
      kind          = 'PHOTO',
      acorns        = 1,
      display_order = 1,
      approval_mode = 'AUTO',
      unlock_rule   = 'ALWAYS',
      is_active     = true,
      config_json   = jsonb_build_object(
        'min_photos', 1,
        'prompt', '우리 가족 모두 함께 사진을 찍어서 업로드해 주세요!',
        'require_caption', false
      ),
      updated_at    = now()
    WHERE id = v_existing_id;

    RAISE NOTICE '[first_mission_family_photo] 기존 미션 업데이트 (id=%)', v_existing_id;
  ELSE
    -- INSERT
    INSERT INTO org_missions (
      org_id, quest_pack_id, kind, title, description,
      acorns, display_order, unlock_rule, approval_mode,
      is_active, config_json
    ) VALUES (
      v_org_id, v_pack_id, 'PHOTO',
      '우리가족 사진찍기!',
      '가족 모두가 함께 찍은 사진을 올려주세요',
      1, 1, 'ALWAYS', 'AUTO',
      true,
      jsonb_build_object(
        'min_photos', 1,
        'prompt', '우리 가족 모두 함께 사진을 찍어서 업로드해 주세요!',
        'require_caption', false
      )
    );

    RAISE NOTICE '[first_mission_family_photo] 새 미션 INSERT (pack=%)', v_pack_id;
  END IF;
END $$;

-- 실행 후: NOTIFY pgrst, 'reload schema';
