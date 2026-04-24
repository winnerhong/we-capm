-- ============================================================
-- 파트너(숲지기) 프로필 확장: 회사정보 + 정산계좌
-- ============================================================

-- 회사 정보
ALTER TABLE partners ADD COLUMN IF NOT EXISTS business_number text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS representative_name text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS address text;

-- 정산 계좌
ALTER TABLE partners ADD COLUMN IF NOT EXISTS bank_name text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS account_number text;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS account_holder text;
