-- ============================================================================
-- Migration: 20260620000000_event_templates.sql
-- Purpose : 지사가 만드는 "행사 템플릿(패키지)" + 항목 + 지정 기관 + 기관 가져오기 ref
-- Notes   :
--   - partner_event_templates              : 헤더 (이름·설명·이미지·가시성·상태)
--   - partner_event_template_items         : PROGRAM/TRAIL 등 sub-resource 묶음
--                                            required_feature_code 로 platform_features 와 결합
--   - partner_event_template_assignments   : visibility=SELECTED 일 때 지정 기관 매핑
--   - org_events.source_event_template_id  : 기관이 가져온 출처 reference (loose)
--   - 타임테이블/스탬프북/미션팩/FM 프리셋은 추후 phase
--   - RLS: 기존 동일 패턴 (true WITH CHECK true) — 앱이 쿠키 인증
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) partner_event_templates
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_event_templates (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id                  uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name                        text NOT NULL,
  subtitle                    text,
  description                 text,
  cover_image_url             text,
  recommended_duration_hours  numeric(5,2),
  recommended_capacity_min    integer,
  recommended_capacity_max    integer,
  visibility                  text NOT NULL DEFAULT 'PRIVATE'
                                CHECK (visibility IN ('ALL','SELECTED','PRIVATE')),
  status                      text NOT NULL DEFAULT 'DRAFT'
                                CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  is_deleted                  boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  partner_event_templates IS '지사가 만든 행사 템플릿(패키지). 기관이 활성화/가져오기로 자기 행사로 복사.';
COMMENT ON COLUMN partner_event_templates.visibility IS 'ALL=모든 기관 / SELECTED=지정 기관만 / PRIVATE=비공개';

CREATE INDEX IF NOT EXISTS idx_partner_event_templates_partner
  ON partner_event_templates (partner_id, status, is_deleted);
CREATE INDEX IF NOT EXISTS idx_partner_event_templates_visibility
  ON partner_event_templates (visibility, status, is_deleted);

-- updated_at 트리거 (이전 마이그레이션에서 만들어진 함수 재사용)
DROP TRIGGER IF EXISTS partner_event_templates_touch_updated_at ON partner_event_templates;
CREATE TRIGGER partner_event_templates_touch_updated_at
  BEFORE UPDATE ON partner_event_templates
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE partner_event_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_event_templates_all ON partner_event_templates;
CREATE POLICY partner_event_templates_all ON partner_event_templates
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) partner_event_template_items
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_event_template_items (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id             uuid NOT NULL REFERENCES partner_event_templates(id) ON DELETE CASCADE,
  item_type               text NOT NULL
                            CHECK (item_type IN ('PROGRAM','TRAIL','STAMPBOOK_PRESET','MISSION_PACK','FM_SESSION_PRESET')),
  item_id                 uuid NOT NULL,                 -- partner_programs.id / partner_trails.id 등
  item_name_snapshot      text,                          -- 표시용 캐시 (원본 삭제·이름변경 대비)
  sort_order              integer NOT NULL DEFAULT 100,
  is_required             boolean NOT NULL DEFAULT true,
  required_feature_code   text REFERENCES platform_features(code) ON DELETE SET NULL,
  note                    text,
  created_at              timestamptz NOT NULL DEFAULT now(),
  updated_at              timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  partner_event_template_items IS '템플릿 구성품. item_id 는 item_type 별 partner-side 테이블의 row id.';
COMMENT ON COLUMN partner_event_template_items.required_feature_code IS '이 항목 사용에 필요한 platform_features.code (예: TRAIL → "TRAIL"). PROGRAM 은 NULL.';

CREATE INDEX IF NOT EXISTS idx_partner_event_template_items_template
  ON partner_event_template_items (template_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_partner_event_template_items_lookup
  ON partner_event_template_items (item_type, item_id);

DROP TRIGGER IF EXISTS partner_event_template_items_touch_updated_at ON partner_event_template_items;
CREATE TRIGGER partner_event_template_items_touch_updated_at
  BEFORE UPDATE ON partner_event_template_items
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE partner_event_template_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_event_template_items_all ON partner_event_template_items;
CREATE POLICY partner_event_template_items_all ON partner_event_template_items
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) partner_event_template_assignments (visibility=SELECTED 매핑)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_event_template_assignments (
  template_id   uuid NOT NULL REFERENCES partner_event_templates(id) ON DELETE CASCADE,
  org_id        uuid NOT NULL,                            -- orgs.id (FK 느슨)
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (template_id, org_id)
);

COMMENT ON TABLE partner_event_template_assignments IS 'visibility=SELECTED 인 템플릿이 어떤 기관에 노출되는지 매핑';

CREATE INDEX IF NOT EXISTS idx_partner_event_template_assignments_org
  ON partner_event_template_assignments (org_id);

ALTER TABLE partner_event_template_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_event_template_assignments_all ON partner_event_template_assignments;
CREATE POLICY partner_event_template_assignments_all ON partner_event_template_assignments
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4) org_events 에 source_event_template_id 추가 (출처 reference, loose FK)
-- ---------------------------------------------------------------------------
ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS source_event_template_id uuid;

COMMENT ON COLUMN org_events.source_event_template_id IS
  '이 행사가 어느 partner_event_templates 에서 가져왔는지 출처. NULL = 직접 생성.';

CREATE INDEX IF NOT EXISTS idx_org_events_source_template
  ON org_events (source_event_template_id)
  WHERE source_event_template_id IS NOT NULL;
