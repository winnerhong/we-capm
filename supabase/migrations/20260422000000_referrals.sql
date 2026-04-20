-- =====================================================
-- Referral Program (친구 초대)
-- Tracks referral codes, invitees, and reward payouts
-- =====================================================

CREATE TABLE IF NOT EXISTS referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_phone text NOT NULL,
  referrer_name text,
  referrer_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  referral_code text UNIQUE NOT NULL,
  invitee_phone text,
  invitee_name text,
  invitee_joined_at timestamptz,
  invitee_event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','JOINED','COMPLETED','EXPIRED')),
  reward_acorns int NOT NULL DEFAULT 20,
  reward_given boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_phone);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_referrals_invitee ON referrals(invitee_phone);
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "referrals_all" ON referrals;
CREATE POLICY "referrals_all" ON referrals FOR ALL USING (true) WITH CHECK (true);
