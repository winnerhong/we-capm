-- =====================================================
-- Toriro Phase C Migration
-- 7 new tables: partners, subscriptions, coupons,
--   coupon_deliveries, ad_campaigns, guilds, guild_members,
--   challenges
-- =====================================================

-- ----------------------------------------
-- 1) partners (숲지기/업체)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS partners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  business_name text,
  username text UNIQUE NOT NULL,
  password text NOT NULL,
  email text,
  phone text,
  tier text NOT NULL DEFAULT 'SPROUT' CHECK (tier IN ('SPROUT','EXPLORER','TREE','FOREST','LEGEND')),
  commission_rate numeric NOT NULL DEFAULT 20 CHECK (commission_rate >= 0 AND commission_rate <= 100),
  acorn_balance int NOT NULL DEFAULT 0,
  total_sales numeric NOT NULL DEFAULT 0,
  total_events int NOT NULL DEFAULT 0,
  avg_rating numeric,
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','CLOSED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partners_tier ON partners(tier);
CREATE INDEX IF NOT EXISTS idx_partners_status ON partners(status);

-- ----------------------------------------
-- 2) subscriptions (가족 구독)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_phone text NOT NULL,
  tier text NOT NULL CHECK (tier IN ('SPROUT','TREE','FOREST')),
  monthly_price int NOT NULL,
  monthly_acorns int NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','PAUSED','CANCELED')),
  started_at timestamptz NOT NULL DEFAULT now(),
  next_billing_at timestamptz NOT NULL,
  canceled_at timestamptz,
  auto_renew boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_phone ON subscriptions(participant_phone);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- ----------------------------------------
-- 3) coupons (가맹점 쿠폰)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_name text NOT NULL,
  affiliate_phone text,
  title text NOT NULL,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('PERCENT','AMOUNT','FREE')),
  discount_value int,
  min_amount int,
  category text CHECK (category IN ('FOOD','CAFE','DESSERT','ACTIVITY','EDU','OTHER')),
  send_delay_minutes int NOT NULL DEFAULT 30,
  location_lat numeric,
  location_lng numeric,
  location_radius_km numeric DEFAULT 2,
  valid_from timestamptz,
  valid_until timestamptz,
  max_uses int,
  used_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('DRAFT','ACTIVE','PAUSED','EXPIRED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coupons_status ON coupons(status);
CREATE INDEX IF NOT EXISTS idx_coupons_affiliate ON coupons(affiliate_name);

-- ----------------------------------------
-- 4) coupon_deliveries (쿠폰 발송 내역)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS coupon_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  participant_phone text NOT NULL,
  event_id uuid REFERENCES events(id) ON DELETE SET NULL,
  delivered_at timestamptz NOT NULL DEFAULT now(),
  used_at timestamptz,
  used_amount int
);
CREATE INDEX IF NOT EXISTS idx_coupon_del_participant ON coupon_deliveries(participant_phone);
CREATE INDEX IF NOT EXISTS idx_coupon_del_coupon ON coupon_deliveries(coupon_id);

-- ----------------------------------------
-- 5) ad_campaigns (광고 캠페인)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS ad_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  advertiser_name text NOT NULL,
  title text NOT NULL,
  description text,
  creative_url text,
  target_portal text NOT NULL CHECK (target_portal IN ('FAMILY','ORG','PARTNER','TALK')),
  target_region text,
  target_age_group text,
  placement text NOT NULL CHECK (placement IN ('BANNER','CARD','INLINE','POPUP')),
  budget int NOT NULL DEFAULT 0,
  spent int NOT NULL DEFAULT 0,
  impressions int NOT NULL DEFAULT 0,
  clicks int NOT NULL DEFAULT 0,
  conversions int NOT NULL DEFAULT 0,
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PENDING','ACTIVE','PAUSED','ENDED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ads_status ON ad_campaigns(status);

-- ----------------------------------------
-- 6) guilds (숲 패밀리)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS guilds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  icon text DEFAULT '🏡',
  leader_phone text NOT NULL,
  max_members int NOT NULL DEFAULT 10,
  total_acorns int NOT NULL DEFAULT 0,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS guild_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guild_id uuid NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
  participant_phone text NOT NULL,
  participant_name text NOT NULL,
  role text NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('LEADER','MEMBER')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(guild_id, participant_phone)
);
CREATE INDEX IF NOT EXISTS idx_guilds_event ON guilds(event_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_guild ON guild_members(guild_id);
CREATE INDEX IF NOT EXISTS idx_guild_members_phone ON guild_members(participant_phone);

-- ----------------------------------------
-- 7) challenges (주간 챌린지)
-- ----------------------------------------
CREATE TABLE IF NOT EXISTS challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  icon text DEFAULT '🎯',
  goal_type text NOT NULL CHECK (goal_type IN ('MISSION_COUNT','ACORN_COUNT','STAMP_COUNT','ATTENDANCE')),
  goal_value int NOT NULL,
  reward_acorns int NOT NULL DEFAULT 0,
  reward_badge text,
  starts_at timestamptz NOT NULL DEFAULT now(),
  ends_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','ENDED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_challenges_event ON challenges(event_id);
CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);

-- =====================================================
-- RLS: enable + open policies (auth handled at app layer)
-- =====================================================
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partners_all" ON partners;
CREATE POLICY "partners_all" ON partners FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "subscriptions_all" ON subscriptions;
CREATE POLICY "subscriptions_all" ON subscriptions FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "coupons_all" ON coupons;
CREATE POLICY "coupons_all" ON coupons FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "coupon_deliveries_all" ON coupon_deliveries;
CREATE POLICY "coupon_deliveries_all" ON coupon_deliveries FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "ad_campaigns_all" ON ad_campaigns;
CREATE POLICY "ad_campaigns_all" ON ad_campaigns FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "guilds_all" ON guilds;
CREATE POLICY "guilds_all" ON guilds FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "guild_members_all" ON guild_members;
CREATE POLICY "guild_members_all" ON guild_members FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "challenges_all" ON challenges;
CREATE POLICY "challenges_all" ON challenges FOR ALL USING (true) WITH CHECK (true);

-- =====================================================
-- Realtime publications (idempotent)
-- =====================================================
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE coupon_deliveries;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE guild_members;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
  EXCEPTION WHEN duplicate_object THEN NULL;
  END;
END $$;
