-- ============================================================
-- org_invitation_templates — 기관별 초대장 인사말/내용 템플릿.
--
-- 목적:
--   행사를 만들 때마다 인사말·초대장 내용을 새로 적지 않도록
--   자주 쓰는 문구를 미리 저장해 두고 편집 폼에서 셀렉터로 불러옴.
--   (gift_templates 와 같은 패턴)
--
-- 사용처:
--   - /org/[orgId]/invitations/templates : 목록·생성·수정·아카이브
--   - /org/[orgId]/events/[eventId]/edit : 초대장 섹션 상단 "템플릿 불러오기"
--
-- RLS:
--   Phase 0 permissive — server action 에서 requireOrg() 로 권한 검증.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_invitation_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.partner_orgs(id) ON DELETE CASCADE,
  label text NOT NULL,
  message text NULL,
  body text NULL,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_invitation_templates_org_list
  ON public.org_invitation_templates(org_id, is_archived, sort_order, created_at DESC);

ALTER TABLE public.org_invitation_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_invitation_templates_all" ON public.org_invitation_templates;
CREATE POLICY "org_invitation_templates_all" ON public.org_invitation_templates
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_org_invitation_templates_updated ON public.org_invitation_templates';
    EXECUTE 'CREATE TRIGGER trg_org_invitation_templates_updated
             BEFORE UPDATE ON public.org_invitation_templates
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

COMMENT ON COLUMN public.org_invitation_templates.label
  IS '템플릿 이름 — 셀렉터에 노출 (예: "봄 트레일 표준", "운동회 안내").';
COMMENT ON COLUMN public.org_invitation_templates.message
  IS '인사말 (짧은 한 줄). 행사의 invitation_message 자리에 채워짐.';
COMMENT ON COLUMN public.org_invitation_templates.body
  IS '초대장 본문 (긴 multi-line). 행사의 invitation_body 자리에 채워짐.';
