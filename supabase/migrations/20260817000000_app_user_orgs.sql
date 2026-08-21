-- =====================================================
-- app_user_orgs — 보호자 ↔ 기관 다중 소속 (N:M)
--
-- 배경:
--   app_users.phone 은 전역 UNIQUE, app_users.org_id 는 단일 NOT NULL.
--   즉 "전화번호 1개 = 계정 1개 = 기관 1개" 로 못박혀 있어서, 한 보호자가
--   두 기관의 초대장을 받으면 구조적으로 두 번째 기관에 소속될 수 없었다.
--   → 초대장 열람 시 "다른 기관 계정으로 로그인되어 있어요" 차단 발생.
--
-- 조치:
--   소속을 별도 테이블로 분리해 N:M 으로 확장.
--
-- app_users.org_id 는 삭제하지 않는다.
--   - 의미만 "홈 기관(최초 소속)" 으로 재정의.
--   - 참가자 앱 40여 곳이 세션의 orgId(= 활성 기관) 를 읽고 있어, 컬럼을
--     제거하면 점진 전환이 불가능해진다.
--
-- 도토리(acorn_balance / user_acorn_transactions) 는 계정 단위 유지.
--   기관별로 쪼개면 쿠폰·장식 사용처까지 전부 분리해야 하므로 범위 밖.
--   랭킹(loadTopAcornFamilies)만 소속 기준으로 노출한다.
--
-- 재실행 안전(idempotent).
-- =====================================================

CREATE TABLE IF NOT EXISTS app_user_orgs (
  user_id   uuid NOT NULL REFERENCES app_users(id)    ON DELETE CASCADE,
  org_id    uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  -- backfill | bulk_import | self_register | invitation | admin
  source    text NOT NULL DEFAULT 'backfill',
  PRIMARY KEY (user_id, org_id)
);

COMMENT ON TABLE app_user_orgs IS
  '보호자 ↔ 기관 다중 소속. app_users.org_id 는 홈(최초) 기관, 이 테이블이 실제 접근 권한.';
COMMENT ON COLUMN app_user_orgs.source IS
  '소속이 생긴 경로: backfill / bulk_import / self_register / invitation / admin';

-- 기관 관제 명단 조회(org_id → user_id 다건) 가 주 패턴.
CREATE INDEX IF NOT EXISTS idx_app_user_orgs_org
  ON app_user_orgs(org_id);

-- 백필 — 기존 단일 소속을 전량 이관.
INSERT INTO app_user_orgs (user_id, org_id, joined_at, source)
SELECT id, org_id, created_at, 'backfill'
  FROM app_users
 WHERE org_id IS NOT NULL
ON CONFLICT (user_id, org_id) DO NOTHING;

-- 이미 타 기관 행사에 참가 중인 유저도 소속으로 승격.
--   org_event_participants 는 org 컬럼이 없어 진작부터 기관 무관이었고,
--   그래서 "참가는 했는데 소속이 아닌" 유저가 존재할 수 있다.
INSERT INTO app_user_orgs (user_id, org_id, joined_at, source)
SELECT p.user_id, e.org_id, MIN(p.joined_at), 'backfill'
  FROM org_event_participants p
  JOIN org_events e ON e.id = p.event_id
 WHERE p.user_id IS NOT NULL
   AND e.org_id IS NOT NULL
 GROUP BY p.user_id, e.org_id
ON CONFLICT (user_id, org_id) DO NOTHING;

-- RLS — app_users / org_event_participants 와 동일한 Phase 0 정책(전체 허용).
--   서버 라우트가 service-role 로 접근하며 앱 레벨에서 가드한다.
ALTER TABLE app_user_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "app_user_orgs_all" ON app_user_orgs;
CREATE POLICY "app_user_orgs_all" ON app_user_orgs
  FOR ALL USING (true) WITH CHECK (true);

-- PostgREST 스키마 캐시 새로고침
NOTIFY pgrst, 'reload schema';
