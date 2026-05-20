-- ============================================================
-- partner_timetable_templates — 지사가 만든 행사 타임테이블 기본 템플릿.
--
-- 목적:
--   지사가 자주 쓰는 행사 진행표(슬롯 묶음)를 미리 만들어 두면, 기관이
--   행사 타임테이블 편집기에서 "기본 템플릿 가져오기" 한 번으로 슬롯 전체를
--   채울 수 있도록 함.
--
-- 데이터 모델:
--   org_event_timeline_slots 와 동일하게 duration_min(소요시간) 기반.
--   가져갈 때 행사 starts_at + 누적 duration 으로 절대시각이 계산되므로
--   별도 변환이 필요 없음.
--
-- 사용처:
--   - /partner/timetable-templates : 목록·생성·수정·아카이브
--   - /org/[orgId]/events/[eventId] 타임테이블 탭 : "기본 템플릿 가져오기"
--
-- RLS:
--   Phase 0 permissive — server action 에서 requirePartner / requireOrg 로 검증.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_timetable_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NULL,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.partner_timetable_template_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL
    REFERENCES public.partner_timetable_templates(id) ON DELETE CASCADE,
  slot_kind text NOT NULL DEFAULT 'CUSTOM',
  title text NOT NULL,
  description text NULL,
  location text NULL,
  icon_emoji text NULL,
  duration_min int NOT NULL DEFAULT 15,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_timetable_templates_list
  ON public.partner_timetable_templates(partner_id, is_archived, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_partner_timetable_template_slots_template
  ON public.partner_timetable_template_slots(template_id, sort_order);

ALTER TABLE public.partner_timetable_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_timetable_templates_all" ON public.partner_timetable_templates;
CREATE POLICY "partner_timetable_templates_all" ON public.partner_timetable_templates
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.partner_timetable_template_slots ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_timetable_template_slots_all" ON public.partner_timetable_template_slots;
CREATE POLICY "partner_timetable_template_slots_all" ON public.partner_timetable_template_slots
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_timetable_templates_updated ON public.partner_timetable_templates';
    EXECUTE 'CREATE TRIGGER trg_partner_timetable_templates_updated
             BEFORE UPDATE ON public.partner_timetable_templates
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
    EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_timetable_template_slots_updated ON public.partner_timetable_template_slots';
    EXECUTE 'CREATE TRIGGER trg_partner_timetable_template_slots_updated
             BEFORE UPDATE ON public.partner_timetable_template_slots
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

COMMENT ON TABLE public.partner_timetable_templates
  IS '지사 행사 타임테이블 기본 템플릿. 기관이 행사 타임테이블 편집기에서 불러와 사용.';
COMMENT ON COLUMN public.partner_timetable_template_slots.duration_min
  IS '슬롯 소요시간(분). org_event_timeline_slots 와 동일 모델. 가져올 때 누적합으로 시각 계산.';
COMMENT ON COLUMN public.partner_timetable_template_slots.slot_kind
  IS 'MISSION/STAMPBOOK/FM_SESSION/BROADCAST/TRAIL/FREE/MEAL/BREAK/CUSTOM — 앱에서 검증 (CHECK 없음).';
