-- ============================================================
-- Universal Billing System (all portals)
-- ============================================================

-- 청구서
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  issued_by_type text NOT NULL CHECK (issued_by_type IN ('ADMIN','SYSTEM','PARTNER','PLATFORM')),
  issued_by_id text NOT NULL,
  target_type text NOT NULL CHECK (target_type IN ('PARTNER','MANAGER','PARTICIPANT','ADVERTISER','AFFILIATE','ORG','B2B_CLIENT')),
  target_id text NOT NULL,
  target_name text,
  target_email text,
  target_phone text,
  category text NOT NULL CHECK (category IN ('ACORN_RECHARGE','SUBSCRIPTION','EVENT_FEE','AD_CAMPAIGN','COUPON_FEE','B2B_CONTRACT','SETTLEMENT','REFUND','OTHER')),
  amount int NOT NULL,
  bonus_rate numeric DEFAULT 0,
  bonus_amount int DEFAULT 0,
  vat int NOT NULL DEFAULT 0,
  total_amount int NOT NULL,
  acorns_credited int DEFAULT 0,
  payment_methods text[] NOT NULL,
  bank_account text,
  payment_link_token text UNIQUE,
  description text,
  memo text,
  metadata jsonb DEFAULT '{}',
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('DRAFT','PENDING','PAID','CONFIRMED','EXPIRED','CANCELED','REFUNDED')),
  issued_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  paid_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by text,
  canceled_at timestamptz,
  tax_invoice_issued boolean NOT NULL DEFAULT false,
  email_sent_at timestamptz,
  reminder_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_invoices_target ON invoices(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_category ON invoices(category);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_issued ON invoices(issued_at DESC);

-- 결제 트랜잭션
CREATE TABLE IF NOT EXISTS payment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('CARD','KAKAOPAY','NAVERPAY','TOSSPAY','BANK_TRANSFER','VIRTUAL_ACCOUNT','ESCROW')),
  amount int NOT NULL,
  fee int DEFAULT 0,
  net_amount int NOT NULL,
  pg_provider text,
  pg_transaction_id text,
  pg_response jsonb,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','PROCESSING','SUCCESS','FAILED','CANCELED','REFUNDED')),
  attempted_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  failure_reason text,
  refunded_amount int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payments_invoice ON payment_transactions(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payment_transactions(status);
CREATE INDEX IF NOT EXISTS idx_payments_pg ON payment_transactions(pg_transaction_id);

-- 세금계산서
CREATE TABLE IF NOT EXISTS tax_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  tax_invoice_number text UNIQUE,
  type text NOT NULL CHECK (type IN ('TAX','CASH_RECEIPT','SIMPLE_RECEIPT')),
  supplier_business_number text,
  supplier_name text,
  supplier_representative text,
  supplier_address text,
  buyer_business_number text,
  buyer_name text,
  buyer_representative text,
  buyer_address text,
  buyer_email text,
  item_name text NOT NULL,
  supply_amount int NOT NULL,
  tax_amount int NOT NULL,
  total_amount int NOT NULL,
  issue_date date NOT NULL DEFAULT CURRENT_DATE,
  hometax_status text DEFAULT 'PENDING' CHECK (hometax_status IN ('PENDING','SUBMITTED','APPROVED','REJECTED')),
  hometax_reference text,
  hometax_response jsonb,
  pdf_url text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tax_inv_invoice ON tax_invoices(invoice_id);
CREATE INDEX IF NOT EXISTS idx_tax_inv_number ON tax_invoices(tax_invoice_number);

-- 정산 내역 (지사)
CREATE TABLE IF NOT EXISTS settlements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  gross_sales int NOT NULL DEFAULT 0,
  refunds int NOT NULL DEFAULT 0,
  commission_rate numeric NOT NULL,
  commission_amount int NOT NULL DEFAULT 0,
  acorn_deduction int NOT NULL DEFAULT 0,
  other_deductions int NOT NULL DEFAULT 0,
  net_amount int NOT NULL DEFAULT 0,
  bank_account text,
  account_holder text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','REVIEW','APPROVED','PAID','DISPUTED')),
  reviewed_by text,
  approved_by text,
  paid_at timestamptz,
  pay_reference text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_settlements_partner ON settlements(partner_id);
CREATE INDEX IF NOT EXISTS idx_settlements_period ON settlements(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_settlements_status ON settlements(status);

-- 환불 내역
CREATE TABLE IF NOT EXISTS refunds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_transaction_id uuid REFERENCES payment_transactions(id) ON DELETE SET NULL,
  invoice_id uuid REFERENCES invoices(id) ON DELETE SET NULL,
  requested_by_type text NOT NULL,
  requested_by_id text NOT NULL,
  reason text NOT NULL,
  reason_category text CHECK (reason_category IN ('SCHEDULE_CONFLICT','HEALTH','SERVICE_ISSUE','DUPLICATE','OTHER')),
  requested_amount int NOT NULL,
  approved_amount int,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','APPROVED','REJECTED','COMPLETED','CANCELED')),
  reviewed_by text,
  reviewed_at timestamptz,
  processed_at timestamptz,
  admin_note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_refunds_invoice ON refunds(invoice_id);
CREATE INDEX IF NOT EXISTS idx_refunds_status ON refunds(status);

-- RLS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tax_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE refunds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_all" ON invoices;
CREATE POLICY "invoices_all" ON invoices FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "payment_transactions_all" ON payment_transactions;
CREATE POLICY "payment_transactions_all" ON payment_transactions FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "tax_invoices_all" ON tax_invoices;
CREATE POLICY "tax_invoices_all" ON tax_invoices FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "settlements_all" ON settlements;
CREATE POLICY "settlements_all" ON settlements FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "refunds_all" ON refunds;
CREATE POLICY "refunds_all" ON refunds FOR ALL USING (true) WITH CHECK (true);

-- Realtime
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE invoices; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE payment_transactions; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
