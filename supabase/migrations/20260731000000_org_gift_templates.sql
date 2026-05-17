-- ============================================================
-- org_gift_templates — 기관별 미리 저장하는 선물 쿠폰 템플릿.
--
-- 목적:
--   매번 선물을 보낼 때마다 이름·메시지·만료를 새로 입력하지 않도록,
--   자주 쓰는 선물(예: "GS25 5천원 상품권") 을 미리 등록해 두고
--   발급 시 선택해서 폼을 즉시 채울 수 있게 함.
--
-- 사용처:
--   - /org/[orgId]/gifts/templates : 목록·생성·수정·아카이브
--   - /org/[orgId]/gifts/grant     : 발급 폼 상단 "쿠폰 불러오기" 셀렉터
--   - /org/[orgId]/control-room    : 가족 미리보기 패널 인라인 발급 폼
--
-- RLS:
--   Phase 0 permissive (다른 user_gifts 와 동일 패턴).
--   org 권한 검증은 server action 에서 requireOrg() 로 처리.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.org_gift_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.app_orgs(id) ON DELETE CASCADE,
  label text NOT NULL,
  message text NULL,
  gift_url text NULL,
  default_expires_days int NOT NULL DEFAULT 30,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_gift_templates_org_list
  ON public.org_gift_templates(org_id, is_archived, sort_order, created_at DESC);

ALTER TABLE public.org_gift_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_gift_templates_all" ON public.org_gift_templates;
CREATE POLICY "org_gift_templates_all" ON public.org_gift_templates
  FOR ALL USING (true) WITH CHECK (true);

-- updated_at 자동 갱신 트리거 (기존 trigger 함수 set_updated_at 이 있다면 재사용).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at'
  ) THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_org_gift_templates_updated ON public.org_gift_templates';
    EXECUTE 'CREATE TRIGGER trg_org_gift_templates_updated
             BEFORE UPDATE ON public.org_gift_templates
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END$$;
