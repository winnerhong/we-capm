-- ============================================================
-- Partner CRM: 기관/개인/기업 고객 관리
-- ============================================================

-- 1) partner_orgs (기관 고객 - B2B2C)
CREATE TABLE IF NOT EXISTS partner_orgs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  org_name text NOT NULL,
  org_type text CHECK (org_type IN ('DAYCARE','KINDERGARTEN','ELEMENTARY','MIDDLE','HIGH','EDUCATION_OFFICE','OTHER')),
  representative_name text,
  representative_phone text,
  email text,
  address text,
  children_count int DEFAULT 0,
  class_count int DEFAULT 0,
  teacher_count int DEFAULT 0,
  business_number text,
  tax_email text,
  commission_rate numeric DEFAULT 20,
  discount_rate numeric DEFAULT 0,
  contract_start date,
  contract_end date,
  tags text[],
  internal_memo text,
  auto_username text UNIQUE,
  auto_password_hash text,
  first_login_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_partner ON partner_orgs(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_orgs_status ON partner_orgs(status);

-- 2) partner_customers (개인 고객 - B2C)
CREATE TABLE IF NOT EXISTS partner_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  parent_name text NOT NULL,
  parent_phone text NOT NULL,
  email text,
  address text,
  children jsonb DEFAULT '[]'::jsonb,
  interests text[],
  marketing_sms boolean NOT NULL DEFAULT true,
  marketing_email boolean NOT NULL DEFAULT false,
  marketing_kakao boolean NOT NULL DEFAULT true,
  source text,
  total_events int NOT NULL DEFAULT 0,
  total_spent int NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  ltv int NOT NULL DEFAULT 0,
  retention_score numeric,
  tier text NOT NULL DEFAULT 'SPROUT' CHECK (tier IN ('SPROUT','EXPLORER','TREE','FOREST')),
  tags text[],
  memo text,
  auto_username text UNIQUE,
  auto_password_hash text,
  first_login_at timestamptz,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','DORMANT','CHURNED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_customers_partner ON partner_customers(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_customers_phone ON partner_customers(parent_phone);
CREATE INDEX IF NOT EXISTS idx_partner_customers_tier ON partner_customers(tier);

-- 3) partner_companies (기업 고객 - B2B)
CREATE TABLE IF NOT EXISTS partner_companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  company_name text NOT NULL,
  business_number text NOT NULL,
  representative_name text,
  representative_phone text,
  company_email text,
  industry text,
  employee_count int,
  website text,
  total_contracts int NOT NULL DEFAULT 0,
  total_revenue int NOT NULL DEFAULT 0,
  active_contracts int NOT NULL DEFAULT 0,
  next_renewal date,
  interests text[],
  status text NOT NULL DEFAULT 'LEAD' CHECK (status IN ('LEAD','PROPOSED','NEGOTIATING','CONTRACTED','ACTIVE','RENEWAL','CHURNED')),
  pipeline_stage text DEFAULT 'LEAD',
  tags text[],
  memo text,
  auto_username text UNIQUE,
  auto_password_hash text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_companies_partner ON partner_companies(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_companies_biz ON partner_companies(business_number);
CREATE INDEX IF NOT EXISTS idx_partner_companies_status ON partner_companies(status);

-- 4) partner_company_contacts (기업 담당자 - 여러 명)
CREATE TABLE IF NOT EXISTS partner_company_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES partner_companies(id) ON DELETE CASCADE,
  role text CHECK (role IN ('HR','ESG','FINANCE','CEO','MARKETING','OTHER')),
  name text NOT NULL,
  phone text,
  email text,
  department text,
  is_primary boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON partner_company_contacts(company_id);

-- 5) partner_bulk_imports (엑셀 일괄 업로드 이력)
CREATE TABLE IF NOT EXISTS partner_bulk_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  import_type text NOT NULL CHECK (import_type IN ('ORG','CUSTOMER','COMPANY')),
  file_name text,
  total_rows int NOT NULL DEFAULT 0,
  success_rows int NOT NULL DEFAULT 0,
  error_rows int NOT NULL DEFAULT 0,
  skipped_rows int NOT NULL DEFAULT 0,
  error_details jsonb DEFAULT '[]'::jsonb,
  uploaded_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bulk_imports_partner ON partner_bulk_imports(partner_id);
CREATE INDEX IF NOT EXISTS idx_bulk_imports_created ON partner_bulk_imports(created_at DESC);

-- 6) partner_segments (고객 세그먼트)
CREATE TABLE IF NOT EXISTS partner_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  segment_type text CHECK (segment_type IN ('ORG','CUSTOMER','COMPANY','MIXED')),
  rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_update boolean NOT NULL DEFAULT true,
  member_count int NOT NULL DEFAULT 0,
  color text DEFAULT '#2D5A3D',
  icon text DEFAULT '🎯',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_segments_partner ON partner_segments(partner_id);

-- RLS (open policies like rest of project)
ALTER TABLE partner_orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_company_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_bulk_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_segments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_orgs_all" ON partner_orgs;
CREATE POLICY "partner_orgs_all" ON partner_orgs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_customers_all" ON partner_customers;
CREATE POLICY "partner_customers_all" ON partner_customers FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_companies_all" ON partner_companies;
CREATE POLICY "partner_companies_all" ON partner_companies FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_company_contacts_all" ON partner_company_contacts;
CREATE POLICY "partner_company_contacts_all" ON partner_company_contacts FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_bulk_imports_all" ON partner_bulk_imports;
CREATE POLICY "partner_bulk_imports_all" ON partner_bulk_imports FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_segments_all" ON partner_segments;
CREATE POLICY "partner_segments_all" ON partner_segments FOR ALL USING (true) WITH CHECK (true);
