-- ============================================================
-- Partner Marketing Center: 캠페인/자동화/미디어/외부리뷰/랜딩
-- ============================================================

-- 1) partner_campaigns (마케팅 캠페인)
CREATE TABLE IF NOT EXISTS partner_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  goal text CHECK (goal IN ('AWARENESS','LEAD','CONVERSION','RETENTION','REVIEW')),
  target_segment_id uuid,
  target_filter jsonb DEFAULT '{}'::jsonb,
  channels text[] DEFAULT '{}',
  message_title text,
  message_body text,
  message_cta_url text,
  schedule_type text CHECK (schedule_type IN ('IMMEDIATE','SCHEDULED','RECURRING')),
  scheduled_at timestamptz,
  recurring_rule jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SCHEDULED','SENDING','SENT','PAUSED','FAILED')),
  sent_count int NOT NULL DEFAULT 0,
  opened_count int NOT NULL DEFAULT 0,
  clicked_count int NOT NULL DEFAULT 0,
  converted_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_campaigns_partner ON partner_campaigns(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_campaigns_status ON partner_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_partner_campaigns_scheduled ON partner_campaigns(scheduled_at);

-- 2) partner_automations (자동화 시나리오)
CREATE TABLE IF NOT EXISTS partner_automations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN ('SIGNUP','FIRST_PURCHASE','ABANDONED_CART','POST_EVENT','NO_ACTIVITY_30D','REVIEW_REQUEST','BIRTHDAY')),
  trigger_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  executed_count int NOT NULL DEFAULT 0,
  last_executed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_automations_partner ON partner_automations(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_automations_active ON partner_automations(is_active);
CREATE INDEX IF NOT EXISTS idx_partner_automations_trigger ON partner_automations(trigger_type);

-- 3) partner_media_assets (이미지/영상 자산 라이브러리)
CREATE TABLE IF NOT EXISTS partner_media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  asset_type text NOT NULL CHECK (asset_type IN ('IMAGE','VIDEO','AUDIO')),
  storage_path text NOT NULL,
  public_url text,
  file_name text,
  file_size bigint,
  mime_type text,
  width int,
  height int,
  duration_sec int,
  tags text[] NOT NULL DEFAULT '{}',
  used_in jsonb NOT NULL DEFAULT '[]'::jsonb,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_media_partner ON partner_media_assets(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_media_type ON partner_media_assets(asset_type);

-- 4) partner_external_reviews (외부 플랫폼 리뷰 통합)
CREATE TABLE IF NOT EXISTS partner_external_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  program_id uuid REFERENCES partner_programs(id) ON DELETE SET NULL,
  platform text NOT NULL CHECK (platform IN ('NAVER','GOOGLE','INSTAGRAM','BLOG','KAKAO','MANUAL')),
  external_id text,
  author_name text,
  author_avatar text,
  rating numeric(2,1),
  content text,
  published_at timestamptz,
  response_text text,
  response_at timestamptz,
  sentiment text CHECK (sentiment IN ('POSITIVE','NEUTRAL','NEGATIVE')),
  is_flagged boolean NOT NULL DEFAULT false,
  source_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_partner_ext_reviews_partner ON partner_external_reviews(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_ext_reviews_platform ON partner_external_reviews(platform);
CREATE INDEX IF NOT EXISTS idx_partner_ext_reviews_program ON partner_external_reviews(program_id);
CREATE INDEX IF NOT EXISTS idx_partner_ext_reviews_flagged ON partner_external_reviews(is_flagged);

-- 5) partner_landing_pages (랜딩 페이지 빌더 - Phase 1 stub)
CREATE TABLE IF NOT EXISTS partner_landing_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  slug text NOT NULL,
  title text NOT NULL,
  hero_image_url text,
  hero_headline text,
  hero_subheadline text,
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb,
  theme jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  published_at timestamptz,
  view_count int NOT NULL DEFAULT 0,
  conversion_count int NOT NULL DEFAULT 0,
  meta_title text,
  meta_description text,
  og_image_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(partner_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_partner_landing_partner ON partner_landing_pages(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_landing_status ON partner_landing_pages(status);

-- RLS (open policies like rest of project)
ALTER TABLE partner_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_external_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_landing_pages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "partner_campaigns_all" ON partner_campaigns;
CREATE POLICY "partner_campaigns_all" ON partner_campaigns FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_automations_all" ON partner_automations;
CREATE POLICY "partner_automations_all" ON partner_automations FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_media_assets_all" ON partner_media_assets;
CREATE POLICY "partner_media_assets_all" ON partner_media_assets FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_external_reviews_all" ON partner_external_reviews;
CREATE POLICY "partner_external_reviews_all" ON partner_external_reviews FOR ALL USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "partner_landing_pages_all" ON partner_landing_pages;
CREATE POLICY "partner_landing_pages_all" ON partner_landing_pages FOR ALL USING (true) WITH CHECK (true);
