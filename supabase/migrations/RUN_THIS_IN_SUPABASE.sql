ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS onboarding_rewarded boolean NOT NULL DEFAULT false;

ALTER TABLE app_users
  ADD COLUMN IF NOT EXISTS onboarding_bonus_count integer NOT NULL DEFAULT 0;

UPDATE tori_fm_reactions SET emoji = '🌱' WHERE emoji = '🌰';

ALTER TABLE tori_fm_reactions
  DROP CONSTRAINT IF EXISTS tori_fm_reactions_emoji_check;

ALTER TABLE tori_fm_reactions
  ADD CONSTRAINT tori_fm_reactions_emoji_check
  CHECK (emoji IN ('❤','👏','🎉','🌲','🌱','😂'));

DO $$
DECLARE
  v_org        RECORD;
  v_pack_id    uuid;
  v_mission_id uuid;
BEGIN
  FOR v_org IN SELECT id FROM partner_orgs ORDER BY created_at LOOP
    v_pack_id := NULL;

    SELECT id INTO v_pack_id
    FROM org_quest_packs
    WHERE org_id = v_org.id AND status = 'LIVE'
    ORDER BY created_at DESC LIMIT 1;

    IF v_pack_id IS NULL THEN
      SELECT id INTO v_pack_id
      FROM org_quest_packs
      WHERE org_id = v_org.id AND status = 'DRAFT'
      ORDER BY created_at DESC LIMIT 1;

      IF v_pack_id IS NOT NULL THEN
        UPDATE org_quest_packs SET status = 'LIVE', updated_at = now() WHERE id = v_pack_id;
      END IF;
    END IF;

    IF v_pack_id IS NULL THEN
      INSERT INTO org_quest_packs (org_id, name, description, status)
      VALUES (v_org.id, '위너 숲여행 이길', '가족 스탬프북', 'LIVE')
      RETURNING id INTO v_pack_id;
    END IF;

    SELECT id INTO v_mission_id
    FROM org_missions
    WHERE quest_pack_id = v_pack_id
      AND (title ILIKE '%가족 사진%' OR title ILIKE '%가족사진%' OR title = '우리가족 사진찍기!')
    ORDER BY display_order ASC LIMIT 1;

    IF v_mission_id IS NOT NULL THEN
      UPDATE org_missions SET
        title = '우리가족 사진찍기!',
        description = '가족 모두가 함께 찍은 사진을 올려주세요',
        kind = 'PHOTO',
        acorns = 1,
        display_order = 1,
        approval_mode = 'AUTO',
        unlock_rule = 'ALWAYS',
        is_active = true,
        config_json = jsonb_build_object(
          'min_photos', 1,
          'prompt', '우리 가족 모두 함께 사진을 찍어서 업로드해 주세요!',
          'require_caption', false
        ),
        updated_at = now()
      WHERE id = v_mission_id;
    ELSE
      INSERT INTO org_missions (
        org_id, quest_pack_id, kind, title, description,
        acorns, display_order, unlock_rule, approval_mode, is_active, config_json
      ) VALUES (
        v_org.id, v_pack_id, 'PHOTO',
        '우리가족 사진찍기!',
        '가족 모두가 함께 찍은 사진을 올려주세요',
        1, 1, 'ALWAYS', 'AUTO', true,
        jsonb_build_object(
          'min_photos', 1,
          'prompt', '우리 가족 모두 함께 사진을 찍어서 업로드해 주세요!',
          'require_caption', false
        )
      );
    END IF;
  END LOOP;
END $$;

ALTER TABLE partner_stampbook_presets
  ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'PRIVATE'
    CHECK (visibility IN ('PRIVATE', 'ALL_ORGS', 'SELECTED_ORGS'));

CREATE INDEX IF NOT EXISTS idx_stampbook_presets_visibility
  ON partner_stampbook_presets (partner_id, is_published, visibility)
  WHERE is_published = true AND visibility <> 'PRIVATE';

CREATE TABLE IF NOT EXISTS partner_stampbook_preset_org_grants (
  preset_id  uuid NOT NULL REFERENCES partner_stampbook_presets(id) ON DELETE CASCADE,
  org_id     uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  granted_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (preset_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_preset_org_grants_org
  ON partner_stampbook_preset_org_grants (org_id);

ALTER TABLE partner_stampbook_preset_org_grants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "preset_org_grants_all" ON partner_stampbook_preset_org_grants;
CREATE POLICY "preset_org_grants_all" ON partner_stampbook_preset_org_grants
  FOR ALL USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
