-- ============================================================
-- partner_venues — 지사가 자주 쓰는 행사장 카탈로그.
--
-- 목적:
--   지사가 운영하는 모든 행사장을 한 번 등록해 두고, 기관이 행사 편집 폼에서
--   "행사장 불러오기" 셀렉트로 한 번에 인사말 옆 장소·주소·이미지·주차장 정보를
--   자동 채울 수 있도록 함.
--
-- 데이터 형식:
--   parking_lots 는 ParkingLot[] JSONB (program 의 parking_lots 와 동일 포맷)
--   org 행사로 옮길 때 ParkingItem 형식(name/address/image_url)으로 매핑.
--
-- 사용처:
--   - /partner/venues : 목록·생성·수정·아카이브
--   - /org/[orgId]/events/[eventId]/edit : 초대장 섹션 "행사장 불러오기" 셀렉터
--
-- RLS:
--   Phase 0 permissive — server action 에서 requirePartner / requireOrg 로 검증.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.partner_venues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NULL,
  image_url text NULL,
  description text NULL,
  parking_lots jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_archived boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_venues_partner_list
  ON public.partner_venues(partner_id, is_archived, sort_order, created_at DESC);

ALTER TABLE public.partner_venues ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_venues_all" ON public.partner_venues;
CREATE POLICY "partner_venues_all" ON public.partner_venues
  FOR ALL USING (true) WITH CHECK (true);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_updated_at') THEN
    EXECUTE 'DROP TRIGGER IF EXISTS trg_partner_venues_updated ON public.partner_venues';
    EXECUTE 'CREATE TRIGGER trg_partner_venues_updated
             BEFORE UPDATE ON public.partner_venues
             FOR EACH ROW EXECUTE FUNCTION set_updated_at()';
  END IF;
END $$;

COMMENT ON COLUMN public.partner_venues.name
  IS '장소 이름 — 행사 invitation_location 자리에 자동 채움. (예: "침산공원")';
COMMENT ON COLUMN public.partner_venues.parking_lots
  IS 'ParkingLot[] JSONB — name/address/capacity/fee/note/image_url. 기관 행사로 옮길 때 name+address+image_url 만 매핑.';
