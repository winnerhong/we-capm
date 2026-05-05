-- ============================================================================
-- Migration: 20260621000000_event_template_timetable.sql
-- Purpose : 행사 템플릿의 권장 타임테이블 슬롯
-- Notes   :
--   - partner_event_template_timetable_slots
--       template_id 별 offset(분) 기반 슬롯들
--       기관이 가져갈 때 starts_at + offset_min 으로 절대시각 계산하여
--       org_event_timeline_slots 로 INSERT
--   - slot_kind enum 은 org_event_timeline_slots 와 동일 9종 재사용
--   - RLS: 기존 동일 패턴 (true WITH CHECK true)
-- ============================================================================

CREATE TABLE IF NOT EXISTS partner_event_template_timetable_slots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id     uuid NOT NULL REFERENCES partner_event_templates(id) ON DELETE CASCADE,
  offset_min      integer NOT NULL CHECK (offset_min >= 0 AND offset_min <= 6000),
  duration_min    integer CHECK (duration_min IS NULL OR (duration_min > 0 AND duration_min <= 6000)),
  title           text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 100),
  description     text,
  slot_kind       text NOT NULL DEFAULT 'CUSTOM' CHECK (
    slot_kind IN (
      'MISSION','STAMPBOOK','FM_SESSION','BROADCAST','TRAIL',
      'FREE','MEAL','BREAK','CUSTOM'
    )
  ),
  icon_emoji      text,
  location        text,
  ref_item_id     uuid REFERENCES partner_event_template_items(id) ON DELETE SET NULL,
  display_order   integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  partner_event_template_timetable_slots IS
  '행사 템플릿의 권장 타임테이블 슬롯. offset(분) 기반. import 시 starts_at + offset 으로 환산.';
COMMENT ON COLUMN partner_event_template_timetable_slots.offset_min IS
  '행사 시작 0분 기준 오프셋 (분). 0~6000(=100시간) 허용.';
COMMENT ON COLUMN partner_event_template_timetable_slots.duration_min IS
  '슬롯 길이(분). NULL 허용 (점 시각 안내). 1~6000.';
COMMENT ON COLUMN partner_event_template_timetable_slots.ref_item_id IS
  '같은 템플릿의 partner_event_template_items 와 묶기 (예: PROGRAM 항목 슬롯). 옵션.';

CREATE INDEX IF NOT EXISTS idx_partner_event_template_timetable_template
  ON partner_event_template_timetable_slots (template_id, offset_min, display_order);

DROP TRIGGER IF EXISTS partner_event_template_timetable_slots_touch_updated_at
  ON partner_event_template_timetable_slots;
CREATE TRIGGER partner_event_template_timetable_slots_touch_updated_at
  BEFORE UPDATE ON partner_event_template_timetable_slots
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE partner_event_template_timetable_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_event_template_timetable_slots_all
  ON partner_event_template_timetable_slots;
CREATE POLICY partner_event_template_timetable_slots_all
  ON partner_event_template_timetable_slots
  FOR ALL USING (true) WITH CHECK (true);
