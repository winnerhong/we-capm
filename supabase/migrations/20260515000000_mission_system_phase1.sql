-- =====================================================
-- Mission System Phase 1 (MVP) — B2B2C 미션/퀘스트 시스템
-- 자립형 마이그레이션: 테이블/인덱스/정책/트리거 모두 재실행 안전.
--   partner_missions             : 지사 가이드 템플릿 (원본)
--   partner_mission_assignments  : SELECTED 시 특정 기관 배포 대상
--   org_quest_packs              : 기관 스탬프북(퀘스트팩)
--   org_missions                 : 기관 편집본 (원본에서 복제·독립 편집)
--   mission_submissions          : 이용자 제출 기록
--   mission_final_redemptions    : 최종 보상 QR 티켓
--   + user_acorn_transactions.reason CHECK 에 MISSION/MISSION_REVERSE 추가
--   + user_acorn_transactions 멱등 인덱스 (source_type='mission_submission')
-- Phase 0 RLS: 전체 허용(permissive) — Phase X 에서 auth.uid() / 쿠키 클레임 기반으로 조임.
-- NOTE: partner_missions 와 org_missions 의 kind CHECK 는 반드시 동일해야 한다
--       (원본→복제 흐름에서 enum 드리프트 방지).
-- =====================================================

-- ---------------------------------------------------------------
-- 0) updated_at 공용 트리거 함수 (self-contained)
-- ---------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- ---------------------------------------------------------------
-- 1) partner_missions (지사 가이드 템플릿)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN (
    'PHOTO','QR_QUIZ','PHOTO_APPROVAL','COOP','BROADCAST',
    'TREASURE','RADIO','FINAL_REWARD'
  )),
  title text NOT NULL,
  description text,
  icon text,
  default_acorns int NOT NULL DEFAULT 1
    CHECK (default_acorns >= 0 AND default_acorns <= 20),
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  version int NOT NULL DEFAULT 1,
  parent_version_id uuid REFERENCES partner_missions(id),
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED')),
  visibility text NOT NULL DEFAULT 'DRAFT'
    CHECK (visibility IN ('DRAFT','ALL','SELECTED','ARCHIVED')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_partner_missions_partner_kind
  ON partner_missions(partner_id, kind);
CREATE INDEX IF NOT EXISTS idx_partner_missions_status_vis
  ON partner_missions(status, visibility);

-- TODO: Phase X tighten with auth.uid() / cookie-based claim
ALTER TABLE partner_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_missions_all" ON partner_missions;
CREATE POLICY "partner_missions_all" ON partner_missions
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_partner_missions_updated_at ON partner_missions;
CREATE TRIGGER trg_partner_missions_updated_at
  BEFORE UPDATE ON partner_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 2) partner_mission_assignments (SELECTED 시 대상 기관)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_mission_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES partner_missions(id) ON DELETE CASCADE,
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(mission_id, org_id)
);

CREATE INDEX IF NOT EXISTS idx_partner_mission_assignments_org
  ON partner_mission_assignments(org_id);

-- TODO: Phase X tighten with auth.uid() / cookie-based claim
ALTER TABLE partner_mission_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_mission_assignments_all" ON partner_mission_assignments;
CREATE POLICY "partner_mission_assignments_all" ON partner_mission_assignments
  FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------
-- 3) org_quest_packs (기관 스탬프북 = 퀘스트팩)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_quest_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  trail_id uuid REFERENCES partner_trails(id),
  cover_image_url text,
  layout_mode text NOT NULL DEFAULT 'GRID'
    CHECK (layout_mode IN ('GRID','LIST','TRAIL_MAP')),
  stamp_icon_set text NOT NULL DEFAULT 'FOREST'
    CHECK (stamp_icon_set IN ('FOREST','ANIMAL','SEASON')),
  completion_animation text NOT NULL DEFAULT 'BOUNCE',
  status text NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','LIVE','ENDED','ARCHIVED')),
  starts_at timestamptz,
  ends_at timestamptz,
  -- e.g., { "tiers": [{"label":"새싹","threshold":10,"reward_desc":"스티커"}, ...] }
  -- FINAL_REWARD.config_json.tiers 보다 우선 적용
  tier_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_quest_packs_org
  ON org_quest_packs(org_id);
CREATE INDEX IF NOT EXISTS idx_org_quest_packs_status
  ON org_quest_packs(status)
  WHERE status IN ('LIVE','DRAFT');

-- TODO: Phase X tighten with auth.uid() / cookie-based claim
ALTER TABLE org_quest_packs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_quest_packs_all" ON org_quest_packs;
CREATE POLICY "org_quest_packs_all" ON org_quest_packs
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_org_quest_packs_updated_at ON org_quest_packs;
CREATE TRIGGER trg_org_quest_packs_updated_at
  BEFORE UPDATE ON org_quest_packs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 4) org_missions (기관 편집본 — 원본에서 복제·독립)
--    kind CHECK 는 partner_missions 와 완전히 동일해야 한다.
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  quest_pack_id uuid REFERENCES org_quest_packs(id) ON DELETE SET NULL,
  -- 역반영 대비 NULL 허용 (원본이 사라져도 기관 편집본은 독립 생존)
  source_mission_id uuid REFERENCES partner_missions(id),
  kind text NOT NULL CHECK (kind IN (
    'PHOTO','QR_QUIZ','PHOTO_APPROVAL','COOP','BROADCAST',
    'TREASURE','RADIO','FINAL_REWARD'
  )),
  title text NOT NULL,
  description text,
  icon text,
  acorns int NOT NULL DEFAULT 1
    CHECK (acorns >= 0 AND acorns <= 20),
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  display_order int NOT NULL DEFAULT 0,
  unlock_rule text NOT NULL DEFAULT 'ALWAYS'
    CHECK (unlock_rule IN ('ALWAYS','SEQUENTIAL','TIER_GATE')),
  unlock_threshold int,
  unlock_previous_id uuid REFERENCES org_missions(id),
  approval_mode text NOT NULL DEFAULT 'AUTO'
    CHECK (approval_mode IN ('AUTO','MANUAL_TEACHER','AUTO_24H','PARTNER_REVIEW')),
  starts_at timestamptz,
  ends_at timestamptz,
  geofence_lat numeric,
  geofence_lng numeric,
  geofence_radius_m int,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_missions_org
  ON org_missions(org_id);
CREATE INDEX IF NOT EXISTS idx_org_missions_quest_pack
  ON org_missions(quest_pack_id, display_order);
CREATE INDEX IF NOT EXISTS idx_org_missions_active
  ON org_missions(org_id, is_active)
  WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_org_missions_source
  ON org_missions(source_mission_id);

-- TODO: Phase X tighten with auth.uid() / cookie-based claim
ALTER TABLE org_missions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_missions_all" ON org_missions;
CREATE POLICY "org_missions_all" ON org_missions
  FOR ALL USING (true) WITH CHECK (true);

DROP TRIGGER IF EXISTS trg_org_missions_updated_at ON org_missions;
CREATE TRIGGER trg_org_missions_updated_at
  BEFORE UPDATE ON org_missions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 5) mission_submissions (이용자 제출 기록)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_mission_id uuid NOT NULL REFERENCES org_missions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  child_id uuid REFERENCES app_children(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'SUBMITTED' CHECK (status IN (
    'SUBMITTED','AUTO_APPROVED','PENDING_REVIEW','APPROVED','REJECTED','REVOKED'
  )),
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  awarded_acorns int,
  reviewed_by uuid,
  reviewed_at timestamptz,
  reject_reason text,
  idempotency_key text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_mission_sub_user_time
  ON mission_submissions(user_id, submitted_at DESC);
CREATE INDEX IF NOT EXISTS idx_mission_sub_mission
  ON mission_submissions(org_mission_id);
CREATE INDEX IF NOT EXISTS idx_mission_sub_pending
  ON mission_submissions(status)
  WHERE status = 'PENDING_REVIEW';

-- TODO: Phase X tighten with auth.uid() / cookie-based claim
ALTER TABLE mission_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_submissions_all" ON mission_submissions;
CREATE POLICY "mission_submissions_all" ON mission_submissions
  FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------
-- 6) mission_final_redemptions (최종 보상 QR 티켓)
-- ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS mission_final_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  quest_pack_id uuid NOT NULL REFERENCES org_quest_packs(id) ON DELETE CASCADE,
  tier_label text NOT NULL,
  tier_threshold int NOT NULL,
  total_acorns_at_issue int NOT NULL,
  qr_token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  redeemed_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_final_redemp_user
  ON mission_final_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_final_redemp_qr
  ON mission_final_redemptions(qr_token);

-- TODO: Phase X tighten with auth.uid() / cookie-based claim
ALTER TABLE mission_final_redemptions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_final_redemptions_all" ON mission_final_redemptions;
CREATE POLICY "mission_final_redemptions_all" ON mission_final_redemptions
  FOR ALL USING (true) WITH CHECK (true);


-- ---------------------------------------------------------------
-- 7) user_acorn_transactions.reason CHECK 확장
--    기존 제약이 이름(user_acorn_transactions_reason_check)으로 고정되어 있지 않을 수 있어
--    안전하게 DROP IF EXISTS → 재생성.
-- ---------------------------------------------------------------
ALTER TABLE user_acorn_transactions
  DROP CONSTRAINT IF EXISTS user_acorn_transactions_reason_check;

ALTER TABLE user_acorn_transactions
  ADD CONSTRAINT user_acorn_transactions_reason_check
  CHECK (reason IN (
    'STAMP_SLOT','STAMPBOOK_COMPLETE','CHALLENGE','ATTENDANCE',
    'SPEND_COUPON','SPEND_DECORATION','ADMIN_GRANT','ADMIN_DEDUCT','OTHER',
    'MISSION','MISSION_REVERSE'
  ));


-- ---------------------------------------------------------------
-- 8) 멱등 원장 유니크 부분 인덱스
--    동일 mission_submission 에 대한 이중 크레딧 방지.
-- ---------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uniq_user_acorn_tx_mission_source
  ON user_acorn_transactions(source_type, source_id)
  WHERE source_type = 'mission_submission';
