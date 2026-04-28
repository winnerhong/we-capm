-- =====================================================================
-- 행사 초대장 — 상세 주소 + 주차장 N개
-- =====================================================================
-- 목적: 초대장 화면 "오시는 길" 섹션에 주소 기반 카카오/네이버/티맵 버튼과
--      주차장 N개 카드(이름 + 주소 + 지도 버튼)를 노출하기 위한 컬럼 추가.
--
-- invitation_address    : 도로명 / 지번 등 정확한 주소 텍스트 (선택)
-- invitation_parkings   : [{ name: string, address: string }] — 최대 5개
-- =====================================================================

ALTER TABLE org_events
  ADD COLUMN IF NOT EXISTS invitation_address text,
  ADD COLUMN IF NOT EXISTS invitation_parkings jsonb;

COMMENT ON COLUMN org_events.invitation_address IS '초대장 — 행사 장소의 도로명/지번 주소 (지도 검색에 사용)';
COMMENT ON COLUMN org_events.invitation_parkings IS '초대장 — 주차장 정보 [{name,address}] 배열, 최대 5개';
