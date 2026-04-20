-- =====================================================
-- Acorn Recharge Transactions
-- Persistent record of partner acorn credit top-ups
-- =====================================================

CREATE TABLE IF NOT EXISTS acorn_recharges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount int NOT NULL,
  bonus int NOT NULL DEFAULT 0,
  total_credited int NOT NULL,
  payment_transaction_id text,
  payment_method text,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','COMPLETED','FAILED','REFUNDED')),
  initiated_by text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_acorn_recharges_partner ON acorn_recharges(partner_id);
CREATE INDEX IF NOT EXISTS idx_acorn_recharges_status ON acorn_recharges(status);
CREATE INDEX IF NOT EXISTS idx_acorn_recharges_created ON acorn_recharges(created_at DESC);

ALTER TABLE acorn_recharges ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "acorn_recharges_all" ON acorn_recharges;
CREATE POLICY "acorn_recharges_all" ON acorn_recharges FOR ALL USING (true) WITH CHECK (true);
