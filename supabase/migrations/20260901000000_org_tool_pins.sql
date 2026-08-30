-- ============================================================================
-- Migration: 20260901000000_org_tool_pins.sql
-- Purpose : ① 지사 전체 기본값(= "전체 노출")  ② 상단 메뉴 고정
--
-- ## 무엇이 없었나
--   어제 만든 org_feature_switches(20260831000000)는 **기관별 개별**만 있었다.
--   기관 6곳 × 기능 15개 = 최대 90번을 눌러야 지사 전체 방침이 선다.
--   가운데에 "지사 기본값" 한 층이 통째로 비어 있었다.
--
--   그리고 켠 기능도 기관 홈의 접힌 카드(「모든 기능」) 안에만 있었다.
--   상단 메뉴는 코드에 박힌 3개(내 행사·관제실·공지사항)가 전부였다.
--
-- ## 두 축은 층이 다르다 — 한 테이블로 합치지 않은 이유
--     기능 온오프  = **기능** 단위 (15개). 참가자 앱까지 같이 여닫는다.
--     상단 고정    = **도구** 단위 (24개). 화면 배치일 뿐이다.
--   관제실과 관제실 TV 모드는 같은 기능(CONTROL_ROOM)이지만 다른 도구다.
--   반대로 참가자·서류·기관 설정은 끌 수 없는 코어인데 상단에는 올릴 만하다.
--   층을 억지로 맞추면 "관제실은 껐는데 TV 모드는 켜진" 앞뒤 안 맞는 상태가 생긴다.
--
-- ## 상속 (먼저 걸리는 쪽이 이긴다)
--     기관별 개별   org_feature_switches / org_tool_pins
--     지사 전체     partner_feature_defaults / partner_tool_pins   ← 이번에 추가
--     본사 기본     platform_features.org_default_on / (고정 false)
--
--   ⚠ 전체값을 바꿔도 개별 설정한 기관은 **안 바뀐다.** 그래야 "이 기관만 예외"가
--     유지된다. 대신 지사 화면이 "개별 설정 N곳"을 보여주고, 그 행을 지우면
--     전체값으로 되돌아간다.
--
-- 멱등 (IF NOT EXISTS) — 재실행 안전
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) partner_feature_defaults — 지사 전체 기본값 (기능 온오프)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_feature_defaults (
  partner_id   uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  feature_code text NOT NULL REFERENCES platform_features(code) ON DELETE CASCADE,
  enabled      boolean NOT NULL,
  updated_by   uuid,
  note         text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, feature_code)
);

COMMENT ON TABLE partner_feature_defaults
  IS '지사가 자기 기관 전체에 적용하는 기능 기본값. 개별(org_feature_switches)이 있으면 그쪽이 이긴다.';

DROP TRIGGER IF EXISTS partner_feature_defaults_touch ON partner_feature_defaults;
CREATE TRIGGER partner_feature_defaults_touch
  BEFORE UPDATE ON partner_feature_defaults
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE partner_feature_defaults ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_feature_defaults_all ON partner_feature_defaults;
CREATE POLICY partner_feature_defaults_all ON partner_feature_defaults
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 2) 상단 고정 — 도구 단위. 기관별 / 지사 전체 두 벌.
--
--    tool_key 는 lib/org-tools/registry.ts 의 key 다(FK 를 걸 상대 테이블이 없다).
--    레지스트리에서 key 를 바꾸면 여기 행이 고아가 되므로 그 파일에 경고를 달아 뒀다.
--    고아 행은 무해하다 — 앱이 모르는 key 는 그냥 무시한다.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS partner_tool_pins (
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  tool_key   text NOT NULL,
  pinned     boolean NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (partner_id, tool_key)
);

CREATE TABLE IF NOT EXISTS org_tool_pins (
  org_id     uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  tool_key   text NOT NULL,
  pinned     boolean NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (org_id, tool_key)
);

COMMENT ON TABLE partner_tool_pins IS '지사 전체 기본값 — 어떤 도구를 기관 상단 메뉴에 올릴지.';
COMMENT ON TABLE org_tool_pins     IS '기관별 상단 메뉴 고정. 있으면 지사 전체값을 이긴다.';

DROP TRIGGER IF EXISTS partner_tool_pins_touch ON partner_tool_pins;
CREATE TRIGGER partner_tool_pins_touch
  BEFORE UPDATE ON partner_tool_pins
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

DROP TRIGGER IF EXISTS org_tool_pins_touch ON org_tool_pins;
CREATE TRIGGER org_tool_pins_touch
  BEFORE UPDATE ON org_tool_pins
  FOR EACH ROW EXECUTE FUNCTION trg_platform_features_touch_updated_at();

ALTER TABLE partner_tool_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS partner_tool_pins_all ON partner_tool_pins;
CREATE POLICY partner_tool_pins_all ON partner_tool_pins
  FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE org_tool_pins ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_tool_pins_all ON org_tool_pins;
CREATE POLICY org_tool_pins_all ON org_tool_pins
  FOR ALL USING (true) WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- 3) org_feature_flags — 가운데 층(지사 전체) 끼워넣기
--
--    반환 컬럼은 그대로다(앱을 고칠 필요 없음). COALESCE 에 한 단계만 늘린다:
--      기관 개별 → 지사 전체 → 본사 기본
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION org_feature_flags(p_org_id uuid)
RETURNS TABLE (code text, on_for_org boolean, partner_has boolean)
LANGUAGE sql
STABLE
AS $$
  SELECT
    f.code,
    COALESCE(s.enabled, d.enabled, f.org_default_on) AS on_for_org,
    (g.feature_code IS NOT NULL)                     AS partner_has
  FROM platform_features f
  -- ⚠ INNER JOIN 이어야 한다. LEFT 로 두면 없는 기관 id 를 넣었을 때
  --    o.partner_id 가 NULL → grant 가 하나도 안 붙어 **전 기능이 꺼진 것으로**
  --    답한다(행은 나오므로 앱은 "조회 성공" 으로 받는다). INNER 면 0행이 나오고,
  --    앱은 0행을 "모르는 기능 = 켜짐" 으로 처리한다 — 어느 쪽으로 틀리든 열린다.
  JOIN partner_orgs o
    ON o.id = p_org_id
  LEFT JOIN org_feature_switches s
    ON s.org_id = p_org_id AND s.feature_code = f.code
  LEFT JOIN partner_feature_defaults d
    ON d.partner_id = o.partner_id AND d.feature_code = f.code
  LEFT JOIN partner_feature_grants g
    ON g.partner_id = o.partner_id
   AND g.feature_code = f.code
   AND g.status = 'ACTIVE'
   AND (g.expires_at IS NULL OR g.expires_at > now())
  WHERE f.status IN ('GA', 'BETA');
$$;

-- ---------------------------------------------------------------------------
-- 4) org_pinned_tools(org_id) — 상단에 올릴 도구 key 목록. 왕복 1회.
--
--    기능이 켜져 있는지는 여기서 안 본다 — 도구→기능 매핑이 앱(registry.ts)에
--    있어서다. 앱이 이 목록을 받아 canUse 로 한 번 더 거른다. 스위치를 끄면
--    상단에서도 자동으로 빠진다(고정을 따로 풀 필요가 없다).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION org_pinned_tools(p_org_id uuid)
RETURNS TABLE (tool_key text, source text)
LANGUAGE sql
STABLE
AS $$
  SELECT
    k.tool_key,
    CASE WHEN op.tool_key IS NOT NULL THEN 'org' ELSE 'partner' END AS source
  FROM partner_orgs o
  -- 기관 개별과 지사 전체에 등장하는 모든 도구 key 를 모은다
  CROSS JOIN LATERAL (
    SELECT tool_key FROM org_tool_pins     WHERE org_id     = o.id
    UNION
    SELECT tool_key FROM partner_tool_pins WHERE partner_id = o.partner_id
  ) k
  LEFT JOIN org_tool_pins op
    ON op.org_id = o.id AND op.tool_key = k.tool_key
  LEFT JOIN partner_tool_pins pp
    ON pp.partner_id = o.partner_id AND pp.tool_key = k.tool_key
  WHERE o.id = p_org_id
    -- 개별이 있으면 개별값, 없으면 전체값. 어느 쪽도 없으면 애초에 k 에 안 나온다.
    AND COALESCE(op.pinned, pp.pinned, false) = true;
$$;

COMMENT ON FUNCTION org_pinned_tools(uuid)
  IS '이 기관 상단 메뉴에 올릴 도구 key. source=org(개별) / partner(전체값 따름).';

-- ---------------------------------------------------------------------------
-- 5) 지금 화면을 그대로 유지하는 시드 — control-room 고정
--
--    상단 메뉴의 [관제실] 은 지금까지 코드에 박혀 있어서 **어느 기관이든 무조건**
--    떴다. 이제 고정된 도구만 뜨므로, 시드를 넣지 않으면 이 마이그레이션 직후
--    전 기관의 상단에서 관제실이 사라진다. 기능을 옮기는 것이지 없애는 게 아니다.
--
--    지사 전체값으로 넣는다 — 기관별로 넣으면 나중에 지사가 "관제실 안 씀" 으로
--    바꿔도 6곳 전부 개별값에 막혀 안 바뀐다.
-- ---------------------------------------------------------------------------
INSERT INTO partner_tool_pins (partner_id, tool_key, pinned)
SELECT p.id, 'control-room', true
FROM partners p
ON CONFLICT (partner_id, tool_key) DO NOTHING;

-- ⚠ 이게 없으면 새 테이블·함수가 앱에서 "없는 것" 으로 보인다.
NOTIFY pgrst, 'reload schema';

-- ---------------------------------------------------------------------------
-- 검증
-- ---------------------------------------------------------------------------
-- 새 테이블 3개가 보여야 한다
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('partner_feature_defaults', 'partner_tool_pins', 'org_tool_pins')
ORDER BY table_name;

-- 아직 아무것도 고정하지 않았으므로 0행이 정상
SELECT * FROM org_pinned_tools(
  (SELECT id FROM partner_orgs ORDER BY created_at LIMIT 1)
);
