-- ============================================================================
-- Migration: 20260727000000_org_trails_qr.sql
-- Purpose : 기관 자체 코스에 QR 코드 추가.
--           - 8자리 영숫자 코드 (애플리케이션에서 생성)
--           - 스캔 URL: /trail/{qr_code}
--           - 기존 행은 qr_code 가 NULL 일 수 있음 (편집 진입 시 자동 발급)
-- ============================================================================

ALTER TABLE org_trails
  ADD COLUMN IF NOT EXISTS qr_code text NULL;

-- 같은 코드 충돌 방지 — NULL 은 unique 제약에서 자동 제외
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_trails_qr_code
  ON org_trails(qr_code);

COMMENT ON COLUMN org_trails.qr_code
  IS '8자리 영숫자 QR 코드 — 스캔 URL /trail/{qr_code} 로 안내 페이지 오픈. 신규 등록 시 자동 발급.';

-- ============================================================================
-- End of migration 20260727000000_org_trails_qr.sql
-- ============================================================================
