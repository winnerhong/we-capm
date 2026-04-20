-- =====================================================
-- 🌲 토리로 TORIRO - 통합 마이그레이션 (복사 & 붙여넣기용)
-- Supabase 대시보드 → SQL Editor에 붙여넣고 Run
-- 멱등(idempotent) 처리됨 - 여러번 실행해도 안전
-- =====================================================
-- 포함된 테이블 (총 17개):
--   [스탬프 랠리] stamp_boards, stamp_slots, stamp_records, stamp_albums
--   [Phase C] partners, subscriptions, coupons, coupon_deliveries,
--             ad_campaigns, guilds, guild_members, challenges
--   [기타] partner_programs, event_reviews, b2b_inquiries, referrals,
--          acorn_recharges
--   [PIPA] access_logs
-- =====================================================


-- =====================================================
-- 1. 스탬프 랠리 (Stamp Rally)
-- =====================================================

CREATE TABLE IF NOT EXISTS stamp_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  total_slots int NOT NULL CHECK (total_slots > 0 AND total_slots <= 12),
  tier_config jsonb NOT NULL DEFAULT '{"sprout":{"label":"새싹","emoji":"🌱","goal_count":3,"reward_id":null},"explorer":{"label":"탐험가","emoji":"🌿","goal_count":5,"reward_id":null},"keeper":{"label":"숲지킴이","emoji":"🌳","goal_count":8,"reward_id":null}}',
  icon text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stamp_boards_event ON stamp_boards(event_id);

CREATE TABLE IF NOT EXISTS stamp_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES stamp_boards(id) ON DELETE CASCADE,
  "order" int NOT NULL DEFAULT 0,
  name text NOT NULL,
  icon text DEFAULT '📍',
  description text,
  location_hint text,
  type text NOT NULL DEFAULT 'MANUAL' CHECK (type IN ('MANUAL','AUTO_MISSION','AUTO_ENTRY')),
  mission_id uuid REFERENCES missions(id) ON DELETE SET NULL,
  congestion_status text NOT NULL DEFAULT 'GREEN' CHECK (congestion_status IN ('GREEN','YELLOW','RED')),
  staff_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, "order")
);
CREATE INDEX IF NOT EXISTS idx_stamp_slots_board ON stamp_slots(board_id);
CREATE INDEX IF NOT EXISTS idx_stamp_slots_mission ON stamp_slots(mission_id);

CREATE TABLE IF NOT EXISTS stamp_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES stamp_slots(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  stamped_by text,
  photo_url text,
  stamped_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(slot_id, participant_id)
);
CREATE INDEX IF NOT EXISTS idx_stamp_records_slot ON stamp_records(slot_id);
CREATE INDEX IF NOT EXISTS idx_stamp_records_participant ON stamp_records(participant_id);

CREATE TABLE IF NOT EXISTS stamp_albums (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id uuid NOT NULL REFERENCES stamp_slots(id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  caption text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stamp_albums_participant ON stamp_albums(participant_id);


-- =====================================================
-- 2. 파트너/숲지기 (Partners)
-- =====================================================

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


-- =====================================================
-- 3. 구독 (Subscriptions)
-- =====================================================

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


-- =====================================================
-- 4. 쿠폰 & 발송 내역 (Coupons)
-- =====================================================

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


-- =====================================================
-- 5. 광고 캠페인 (Ad Campaigns)
-- =====================================================

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


-- =====================================================
-- 6. 숲 패밀리 (Guilds)
-- =====================================================

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


-- =====================================================
-- 7. 챌린지 (Challenges)
-- =====================================================

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
-- 8. 파트너 프로그램 카탈로그 (Partner Programs)
-- =====================================================

CREATE TABLE IF NOT EXISTS partner_programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid REFERENCES partners(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  category text NOT NULL CHECK (category IN ('FOREST','CAMPING','KIDS','FAMILY','TEAM','ART')),
  duration_hours numeric,
  capacity_min int DEFAULT 5,
  capacity_max int DEFAULT 30,
  price_per_person int NOT NULL,
  b2b_price_per_person int,
  location_region text,
  location_detail text,
  image_url text,
  tags text[],
  rating_avg numeric,
  rating_count int NOT NULL DEFAULT 0,
  booking_count int NOT NULL DEFAULT 0,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_programs_partner ON partner_programs(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_programs_published ON partner_programs(is_published);


-- =====================================================
-- 9. 행사 리뷰 (Event Reviews)
-- =====================================================

CREATE TABLE IF NOT EXISTS event_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_phone text NOT NULL,
  participant_name text,
  rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  mission_highlight text,
  improvement text,
  photo_consent boolean NOT NULL DEFAULT false,
  is_public boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, participant_phone)
);
CREATE INDEX IF NOT EXISTS idx_reviews_event ON event_reviews(event_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON event_reviews(rating);


-- =====================================================
-- 10. B2B 기업 문의 (B2B Inquiries)
-- =====================================================

CREATE TABLE IF NOT EXISTS b2b_inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_name text NOT NULL,
  contact_name text NOT NULL,
  contact_email text,
  contact_phone text,
  expected_attendees text,
  interested_packages text[],
  preferred_date timestamptz,
  message text,
  status text NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW','CONTACTED','PROPOSED','WON','LOST')),
  assigned_to text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_b2b_inquiries_status ON b2b_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_b2b_inquiries_created ON b2b_inquiries(created_at DESC);


-- =====================================================
-- 11. 레퍼럴 (친구 초대)
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


-- =====================================================
-- 12. 도토리 충전 내역 (Acorn Recharges)
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


-- =====================================================
-- 🔒 RLS 활성화 + 오픈 정책 (앱 레이어에서 인증 처리)
-- =====================================================

ALTER TABLE stamp_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE guilds ENABLE ROW LEVEL SECURITY;
ALTER TABLE guild_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE b2b_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE acorn_recharges ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stamp_boards_all" ON stamp_boards;
CREATE POLICY "stamp_boards_all" ON stamp_boards FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stamp_slots_all" ON stamp_slots;
CREATE POLICY "stamp_slots_all" ON stamp_slots FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stamp_records_all" ON stamp_records;
CREATE POLICY "stamp_records_all" ON stamp_records FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "stamp_albums_all" ON stamp_albums;
CREATE POLICY "stamp_albums_all" ON stamp_albums FOR ALL USING (true) WITH CHECK (true);
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
DROP POLICY IF EXISTS "partner_programs_all" ON partner_programs;
CREATE POLICY "partner_programs_all" ON partner_programs FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "event_reviews_all" ON event_reviews;
CREATE POLICY "event_reviews_all" ON event_reviews FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "b2b_inquiries_all" ON b2b_inquiries;
CREATE POLICY "b2b_inquiries_all" ON b2b_inquiries FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "referrals_all" ON referrals;
CREATE POLICY "referrals_all" ON referrals FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "acorn_recharges_all" ON acorn_recharges;
CREATE POLICY "acorn_recharges_all" ON acorn_recharges FOR ALL USING (true) WITH CHECK (true);


-- =====================================================
-- 📜 PIPA 동의 이력 저장 (user_consents) (2026-04-24)
-- =====================================================

CREATE TABLE IF NOT EXISTS user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL,
  user_identifier text NOT NULL,
  terms_agreed boolean NOT NULL DEFAULT false,
  terms_version text,
  privacy_agreed boolean NOT NULL DEFAULT false,
  privacy_version text,
  marketing_agreed boolean NOT NULL DEFAULT false,
  third_party_agreed boolean NOT NULL DEFAULT false,
  age_confirmed boolean NOT NULL DEFAULT false,
  ip_address text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_consents_user
  ON user_consents(user_identifier, created_at DESC);

ALTER TABLE user_consents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "user_consents_all" ON user_consents;
CREATE POLICY "user_consents_all" ON user_consents FOR ALL USING (true) WITH CHECK (true);


-- =====================================================
-- 📡 Realtime 구독 설정 (멱등)
-- =====================================================

DO $$
BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stamp_records;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE stamp_slots;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE coupon_deliveries;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE guild_members;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE challenges;
  EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;


-- =====================================================
-- 🔒 Access audit log for PIPA compliance (2026-04-24)
-- =====================================================
CREATE TABLE IF NOT EXISTS access_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_type text NOT NULL CHECK (user_type IN ('ADMIN','MANAGER','PARTNER','PARTICIPANT','PUBLIC')),
  user_id text,
  user_identifier text,
  action text NOT NULL,
  resource text,
  ip_address text,
  user_agent text,
  status_code int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_access_logs_user ON access_logs(user_identifier, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_action ON access_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_created ON access_logs(created_at DESC);

ALTER TABLE access_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "access_logs_all" ON access_logs;
CREATE POLICY "access_logs_all" ON access_logs FOR ALL USING (true) WITH CHECK (true);

-- Retention: PIPA requires 6+ months of access logs
-- Recommended: delete logs older than 1 year via scheduled job

-- =====================================================
-- ✅ 완료! 17개 테이블 생성됨
-- =====================================================
