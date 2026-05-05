-- ============================================================================
-- Migration: 20260619000000_platform_features.sql
-- Purpose : 본사가 제공하는 "기능(capability)" 카탈로그 + 지사 보유(grant) 관리
-- Notes   :
--   - platform_features         : 본사가 등재한 기능 카탈로그
--   - partner_feature_grants    : 지사가 보유한 기능 (BASIC 자동 / ADMIN_GRANT / 추후 PURCHASE)
--   - platform_feature_audit    : tier·가격·status·grant·revoke 감사 로그
--   - 결제(토스)·invoice 는 추후 phase 에서 추가. setup_fee/monthly_fee 컬럼은
--     메타데이터 자리만 잡아두고 본 phase 에서는 사용하지 않음.
--   - RLS: app 이 쿠키 기반 인증이라 service_role 에서 접근. true WITH CHECK (true)
--          기존 partner_programs / partners 와 동일 패턴.
--   - 멱등 (IF NOT EXISTS / ON CONFLICT DO NOTHING) — 재실행 안전
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) platform_features : 본사 기능 카탈로그
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_features (
  code              text PRIMARY KEY,                                -- 'TORI_FM' 등 슬러그
  name              text NOT NULL,
  short_desc        text,
  long_desc         text,
  icon              text,                                             -- 이모지 또는 아이콘 키
  cover_image_url   text,
  category          text NOT NULL DEFAULT 'OTHER'
                      CHECK (category IN ('BROADCAST','MISSION','CONTENT','ANALYTICS','MARKETING','CORE','OTHER')),
  pack_tier         text NOT NULL DEFAULT 'HIDDEN'
                      CHECK (pack_tier IN ('BASIC','OPTIONAL','HIDDEN')),
  status            text NOT NULL DEFAULT 'DRAFT'
                      CHECK (status IN ('DRAFT','BETA','GA','DEPRECATED')),
  setup_fee_krw     integer NOT NULL DEFAULT 0 CHECK (setup_fee_krw >= 0),
  monthly_fee_krw   integer NOT NULL DEFAULT 0 CHECK (monthly_fee_krw >= 0),
  trial_days        integer NOT NULL DEFAULT 0 CHECK (trial_days >= 0),
  requires_features text[] NOT NULL DEFAULT '{}',
  sort_order        integer NOT NULL DEFAULT 100,
  released_at       timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  platform_features IS '본사가 제공하는 기능(capability) 카탈로그';
COMMENT ON COLUMN platform_features.pack_tier
  IS 'BASIC=신규지사 자동부여 / OPTIONAL=수동 grant 또는 추후 결제로 부여 / HIDDEN=스토어 비노출(베타·내부)';
COMMENT ON COLUMN platform_features.setup_fee_krw
  IS '초기 세팅비(KRW, VAT 별도). 결제 미구현 단계에서는 메타데이터.';
COMMENT ON COLUMN platform_features.monthly_fee_krw
  IS '월 구독료(KRW, VAT 별도). 결제 미구현 단계에서는 메타데이터.';

CREATE INDEX IF NOT EXISTS idx_platform_features_tier_status
  ON platform_features (pack_tier, status);

-- updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION trg_platform_features_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_features_touch_updated_at ON platform_features;
CREATE TRIGGER platform_features_touch_updated_at
  BEFORE UPDATE ON platform_features
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE platform_features ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_features_all ON platform_features;
CREATE POLICY platform_features_all ON platform_features
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) partner_feature_grants : 지사가 보유한 기능
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_feature_grants (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id      uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  feature_code    text NOT NULL REFERENCES platform_features(code) ON DELETE CASCADE,
  source          text NOT NULL DEFAULT 'ADMIN_GRANT'
                    CHECK (source IN ('DEFAULT_PACK','ADMIN_GRANT','PURCHASE','TRIAL','GRANDFATHERED')),
  status          text NOT NULL DEFAULT 'ACTIVE'
                    CHECK (status IN ('ACTIVE','REVOKED')),
  granted_at      timestamptz NOT NULL DEFAULT now(),
  granted_by      uuid,                            -- admin user id (감사용, FK 없음 — admin 테이블 분리됨)
  expires_at      timestamptz,                     -- NULL = 영구. 결제 도입 시 채워짐.
  revoked_at      timestamptz,
  revoked_by      uuid,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE  partner_feature_grants IS '지사별 기능 보유. ACTIVE 인 row 만 권한 인정.';
COMMENT ON COLUMN partner_feature_grants.source
  IS 'DEFAULT_PACK=BASIC 자동 / ADMIN_GRANT=관리자 수동 / PURCHASE=결제(추후) / TRIAL / GRANDFATHERED';

-- ACTIVE 한 (partner, feature) 조합은 단 하나 — 부분 유니크 인덱스
CREATE UNIQUE INDEX IF NOT EXISTS uq_partner_feature_active
  ON partner_feature_grants (partner_id, feature_code)
  WHERE status = 'ACTIVE';

CREATE INDEX IF NOT EXISTS idx_partner_feature_grants_partner
  ON partner_feature_grants (partner_id, status);
CREATE INDEX IF NOT EXISTS idx_partner_feature_grants_feature
  ON partner_feature_grants (feature_code, status);

DROP TRIGGER IF EXISTS partner_feature_grants_touch_updated_at ON partner_feature_grants;
CREATE TRIGGER partner_feature_grants_touch_updated_at
  BEFORE UPDATE ON partner_feature_grants
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE partner_feature_grants ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_feature_grants_all ON partner_feature_grants;
CREATE POLICY partner_feature_grants_all ON partner_feature_grants
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) platform_feature_audit : 변경 이력
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS platform_feature_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_code  text,                                -- 카탈로그 변경일 때
  partner_id    uuid,                                -- 지사 grant/revoke 일 때
  action        text NOT NULL
                  CHECK (action IN (
                    'FEATURE_CREATE','FEATURE_UPDATE','FEATURE_TIER_CHANGE',
                    'FEATURE_PRICE_CHANGE','FEATURE_STATUS_CHANGE',
                    'GRANT_CREATE','GRANT_REVOKE','GRANT_BULK'
                  )),
  actor_admin_id uuid,                               -- 어드민 user_id
  before_json   jsonb,
  after_json    jsonb,
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE platform_feature_audit IS '기능 카탈로그/grant 변경 감사 로그';

CREATE INDEX IF NOT EXISTS idx_platform_feature_audit_feature
  ON platform_feature_audit (feature_code, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_feature_audit_partner
  ON platform_feature_audit (partner_id, created_at DESC);

ALTER TABLE platform_feature_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS platform_feature_audit_all ON platform_feature_audit;
CREATE POLICY platform_feature_audit_all ON platform_feature_audit
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 4) 시드 — 현재 운영 중인 8개 기능 등재
-- ---------------------------------------------------------------------------
INSERT INTO platform_features
  (code, name, short_desc, icon, category, pack_tier, status,
   setup_fee_krw, monthly_fee_krw, sort_order, released_at)
VALUES
  -- 기본팩 (BASIC) ─────────────────────────────────────────
  ('EVENT_BASIC', '행사 운영 기본',
   '행사 만들기·참가자 등록·체크인·정산 등 코어 기능',
   '🏕️', 'CORE', 'BASIC', 'GA',
   0, 0, 10, now()),

  ('PARTNER_DASHBOARD', '지사 대시보드',
   '지사 운영 현황·정산·통계 기본 화면',
   '📊', 'CORE', 'BASIC', 'GA',
   0, 0, 11, now()),

  ('STAMPBOOK', '스탬프북',
   '미션 진행 스탬프 수집 + 완주 보상 기본 모듈',
   '📔', 'MISSION', 'BASIC', 'GA',
   0, 0, 12, now()),

  ('QR_STAMP', 'QR 미션',
   'QR 코드 스캔으로 스탬프 적립',
   '🔲', 'MISSION', 'BASIC', 'GA',
   0, 0, 13, now()),

  -- 유료(현재는 grant 부여) (OPTIONAL) ────────────────────────
  ('TORI_FM', '보이는 라디오 (토리FM)',
   '행사 현장에서 DJ 진행·실시간 채팅·신청곡·VFX 효과',
   '📻', 'BROADCAST', 'OPTIONAL', 'GA',
   300000, 50000, 20, now()),

  ('TRAIL', '나만의 숲길',
   '지사 커스텀 코스(숲길) 제작 + GPS 진행도',
   '🥾', 'CONTENT', 'OPTIONAL', 'GA',
   200000, 30000, 21, now()),

  ('MISSION_LIB', '미션 라이브러리',
   '재사용 가능한 미션 자산 관리·통계',
   '🎯', 'MISSION', 'OPTIONAL', 'GA',
   100000, 20000, 22, now()),

  ('EVENT_TEMPLATE', '행사 템플릿',
   '지사가 행사 패키지를 만들어 기관에 배포',
   '📦', 'CONTENT', 'OPTIONAL', 'GA',
   200000, 30000, 23, now())
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) Grandfathered : 기존 모든 partner 에 GA 기능 전체 부여 (영구 무료)
--    신규 가입 지사부터는 BASIC 만 자동, OPTIONAL 은 수동 grant 필요.
-- ---------------------------------------------------------------------------
INSERT INTO partner_feature_grants
  (partner_id, feature_code, source, status, granted_at, note)
SELECT
  p.id,
  f.code,
  'GRANDFATHERED',
  'ACTIVE',
  now(),
  'auto-granted at platform_features migration'
FROM partners p
CROSS JOIN platform_features f
WHERE f.status = 'GA'
  AND NOT EXISTS (
    SELECT 1 FROM partner_feature_grants g
    WHERE g.partner_id = p.id
      AND g.feature_code = f.code
      AND g.status = 'ACTIVE'
  );

-- 감사 로그 1건 (마이그레이션 자체 기록)
INSERT INTO platform_feature_audit (action, note, after_json)
VALUES (
  'GRANT_BULK',
  'platform_features 마이그레이션 — 기존 모든 지사에 GA 기능 grandfathered 부여',
  jsonb_build_object('migration', '20260619000000_platform_features')
);
