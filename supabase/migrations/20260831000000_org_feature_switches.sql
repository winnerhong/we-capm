-- ============================================================================
-- Migration: 20260831000000_org_feature_switches.sql
-- Purpose : 지사 → 기관 기능 온오프 (스위치 2단계 중 두 번째 열쇠)
--
-- ## 왜 필요한가
--   지금 기능 스위치는 **본사 → 지사** 한 단계뿐이다(20260619000000).
--   지사가 기관별로 조절할 수 있는 것은 스탬프북 프리셋 공유 범위
--   (partner_stampbook_preset_org_grants) 하나뿐이고, 그것도 기능 온오프가
--   아니라 콘텐츠 공유다. "이 유치원은 라디오를 안 쓴다" 를 표현할 방법이 없다.
--
-- ## 모델 — 열쇠 두 개
--     보인다 = 지사가 보유(partner_feature_grants)
--              AND 기관 스위치 ON(org_feature_switches)
--   지사가 못 가진 기능은 기관에 줄 수 없다. 가진 기능만 기관별로 끈다.
--
-- ## 기본값 — 행이 없으면 켜짐(opt-out)
--   행이 있고 enabled=false 일 때만 꺼진다. opt-in 으로 하면 이 마이그레이션
--   직후 기존 6개 기관 화면이 전부 텅 빈다 — 지금 쓰고 있는 기능을 스키마
--   변경이 꺼버리는 것은 사고다.
--   단, 기능별 기본값은 platform_features.org_default_on 으로 뒤집을 수 있다.
--   베타 기능을 전 기관에 자동 노출하고 싶지 않을 때 false 로 등재하면 된다.
--
-- 멱등 (IF NOT EXISTS / ON CONFLICT DO NOTHING) — 재실행 안전
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) platform_features.org_default_on — 스위치 행이 없을 때의 기본값
-- ---------------------------------------------------------------------------
ALTER TABLE platform_features
  ADD COLUMN IF NOT EXISTS org_default_on boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN platform_features.org_default_on
  IS 'org_feature_switches 행이 없을 때의 기관 기본값. true=opt-out(자동 노출), false=opt-in(지사가 켜야 보임)';

-- ---------------------------------------------------------------------------
-- 2) org_feature_switches — 기관별 온오프
--    행이 없으면 platform_features.org_default_on 을 따른다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS org_feature_switches (
  org_id       uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  feature_code text NOT NULL REFERENCES platform_features(code) ON DELETE CASCADE,
  enabled      boolean NOT NULL,
  updated_by   uuid,          -- 지사 팀원 id (감사용, FK 없음 — 팀 테이블 분리)
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, feature_code)
);

COMMENT ON TABLE org_feature_switches
  IS '지사가 기관별로 켜고 끈 기능. 행 없음 = platform_features.org_default_on 을 따름.';

CREATE INDEX IF NOT EXISTS idx_org_feature_switches_feature
  ON org_feature_switches (feature_code, enabled);

DROP TRIGGER IF EXISTS org_feature_switches_touch_updated_at ON org_feature_switches;
CREATE TRIGGER org_feature_switches_touch_updated_at
  BEFORE UPDATE ON org_feature_switches
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE org_feature_switches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_feature_switches_all ON org_feature_switches;
CREATE POLICY org_feature_switches_all ON org_feature_switches
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) 감사 로그 액션 2개 추가 (기존 platform_feature_audit 재사용)
-- ---------------------------------------------------------------------------
ALTER TABLE platform_feature_audit
  DROP CONSTRAINT IF EXISTS platform_feature_audit_action_check;
ALTER TABLE platform_feature_audit
  ADD CONSTRAINT platform_feature_audit_action_check CHECK (action IN (
    'FEATURE_CREATE','FEATURE_UPDATE','FEATURE_TIER_CHANGE',
    'FEATURE_PRICE_CHANGE','FEATURE_STATUS_CHANGE',
    'GRANT_CREATE','GRANT_REVOKE','GRANT_BULK',
    'ORG_SWITCH_ON','ORG_SWITCH_OFF'
  ));

-- org_id 를 담을 칸 (기존 partner_id 와 별도 — 어느 기관인지 알아야 한다)
ALTER TABLE platform_feature_audit
  ADD COLUMN IF NOT EXISTS org_id uuid;

CREATE INDEX IF NOT EXISTS idx_platform_feature_audit_org
  ON platform_feature_audit (org_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- 4) 카탈로그 확장 — 만들어 놓고 등재하지 않은 8개
--
--   등재돼 있던 8개는 실제 기능 20여 개 중 일부였다. 카탈로그에 없으면
--   스위치를 달 수도, 지사가 볼 수도 없다.
--   TORITALK 만 org_default_on=false — 기존 partner_orgs.toritalk_enabled 의
--   기본값이 false 였고, 여기서 true 로 바꾸면 전 기관에 토리톡이 갑자기 켜진다.
-- ---------------------------------------------------------------------------
INSERT INTO platform_features
  (code, name, short_desc, icon, category, pack_tier, status,
   setup_fee_krw, monthly_fee_krw, sort_order, org_default_on, released_at)
VALUES
  ('ACORN', '도토리',
   '참가자가 미션으로 모으고 선물로 바꾸는 행사 화폐',
   '🌰', 'MISSION', 'BASIC', 'GA', 0, 0, 30, true, now()),

  ('GIFT', '선물함 · 쿠폰',
   '도토리로 교환하는 선물·쿠폰 발행과 QR 수령 확인',
   '🎁', 'CONTENT', 'BASIC', 'GA', 0, 0, 31, true, now()),

  ('BINGO', '토리 빙고',
   '행사장에서 함께 채우는 빙고판',
   '🎱', 'MISSION', 'BASIC', 'GA', 0, 0, 32, true, now()),

  ('BROADCAST', '돌발 미션 방송',
   '진행 중에 전체 참가자에게 즉석 미션을 쏘는 기능',
   '📢', 'BROADCAST', 'BASIC', 'GA', 0, 0, 33, true, now()),

  ('TORITALK', '토리톡',
   '반별 보호자 단체 대화방',
   '💬', 'BROADCAST', 'BASIC', 'GA', 0, 0, 34, false, now()),

  ('PHOTO', '사진 나눠보기',
   '참가자가 올린 사진을 함께 보고 좋아요로 도토리 보내기',
   '📸', 'CONTENT', 'BASIC', 'GA', 0, 0, 35, true, now()),

  ('SURVEY', '행사 설문',
   '행사 후 만족도 설문과 응답 집계',
   '📝', 'ANALYTICS', 'BASIC', 'GA', 0, 0, 36, true, now()),

  ('CONTROL_ROOM', '관제실',
   '행사 당일 실시간 현황판 · TV 모드 송출',
   '🛰️', 'CORE', 'BASIC', 'GA', 0, 0, 37, true, now())
ON CONFLICT (code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 5) 신규 기능도 기존 지사에 부여 — 안 하면 지사가 못 가진 기능이라
--    기관 스위치판에 아예 안 뜬다(줄 수 없는 것은 보여주지 않으므로).
-- ---------------------------------------------------------------------------
INSERT INTO partner_feature_grants
  (partner_id, feature_code, source, status, granted_at, note)
SELECT p.id, f.code, 'GRANDFATHERED', 'ACTIVE', now(),
       'auto-granted at org_feature_switches migration'
FROM partners p
CROSS JOIN platform_features f
WHERE f.status = 'GA'
  AND NOT EXISTS (
    SELECT 1 FROM partner_feature_grants g
    WHERE g.partner_id = p.id AND g.feature_code = f.code AND g.status = 'ACTIVE'
  );

-- ---------------------------------------------------------------------------
-- 6) 토리톡 초기값 — partner_orgs.toritalk_enabled 의 현재 값으로 스위치를 채운다.
--
--    ⚠ 컬럼은 **지우지 않는다.** 이관이 아니라 역할 분리다:
--        지사 스위치 = "이 기관에 토리톡을 준다"      (지사가 누른다)
--        기관 컬럼   = "우리 기관이 지금 켰다"        (기관이 누른다)
--      lib/toritalk/queries.ts 의 isToritalkEnabled 가 **둘 다** 확인한다.
--      여기서 현재 컬럼 값을 그대로 복사해 두는 이유는, 이미 켜서 쓰고 있는
--      기관(도원센트럴·참좋은)의 대화방이 이 마이그레이션으로 닫히지 않게 하기 위함.
-- ---------------------------------------------------------------------------
INSERT INTO org_feature_switches (org_id, feature_code, enabled, note)
SELECT o.id, 'TORITALK', COALESCE(o.toritalk_enabled, false),
       'partner_orgs.toritalk_enabled 에서 이관'
FROM partner_orgs o
ON CONFLICT (org_id, feature_code) DO NOTHING;

-- ---------------------------------------------------------------------------
-- 7) org_feature_flags(org_id) — 한 번의 왕복으로 기관의 기능 상태 전부
--
--   참가자 화면은 페이지마다 이걸 부른다. 따로따로 조회하면
--   (기관→지사, 스위치, grant, 카탈로그) 왕복이 네 번이라 그만큼 느려진다.
--
--   on_for_org  : 기관 스위치 (행 없으면 org_default_on)
--   partner_has : 지사가 보유 중인가
--   실제 사용 가능 = on_for_org AND partner_has
--   둘을 나눠 돌려주는 이유 — 기관 화면에서 "지사가 껐음" 과 "지사도 없음" 의
--   안내 문구가 달라야 한다.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION org_feature_flags(p_org_id uuid)
RETURNS TABLE (code text, on_for_org boolean, partner_has boolean)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.code,
    COALESCE(s.enabled, f.org_default_on)                       AS on_for_org,
    (g.feature_code IS NOT NULL)                                AS partner_has
  FROM platform_features f
  -- ⚠ INNER JOIN 이어야 한다. LEFT 로 두면 없는 기관 id 를 넣었을 때
  --    o.partner_id 가 NULL → grant 가 하나도 안 붙어 **전 기능이 꺼진 것으로**
  --    답한다(행은 나오므로 앱은 "조회 성공" 으로 받는다). INNER 면 0행이 나오고,
  --    앱은 0행을 "모르는 기능 = 켜짐" 으로 처리한다 — 어느 쪽으로 틀리든 열린다.
  JOIN partner_orgs o
    ON o.id = p_org_id
  LEFT JOIN org_feature_switches s
    ON s.org_id = p_org_id AND s.feature_code = f.code
  LEFT JOIN partner_feature_grants g
    ON g.partner_id = o.partner_id
   AND g.feature_code = f.code
   AND g.status = 'ACTIVE'
   AND (g.expires_at IS NULL OR g.expires_at > now())
  WHERE f.status IN ('GA', 'BETA');
$$;

COMMENT ON FUNCTION org_feature_flags(uuid)
  IS '기관 하나의 기능 상태 전부를 한 번에. 사용 가능 = on_for_org AND partner_has.';

-- ⚠ 이게 없으면 새 테이블·함수가 앱에서 "없는 것" 으로 보인다.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 검증 — 아래 두 줄이 각각 결과를 내면 정상.
-- ---------------------------------------------------------------------------
-- 카탈로그 16개 (기존 8 + 신규 8)
SELECT count(*) AS feature_count FROM platform_features;

-- 기관 하나의 기능 상태 (첫 번째 기관 기준). TORITALK 만 on_for_org=false 여야 한다.
SELECT * FROM org_feature_flags(
  (SELECT id FROM partner_orgs ORDER BY created_at LIMIT 1)
) ORDER BY code;
