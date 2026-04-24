-- =====================================================
-- Mission System Phase 4 — 역반영 루프 / 도토리 가이드라인 / 통계 뷰
-- 자립형 마이그레이션: 모든 구문 멱등성 확보 (재실행 안전).
--   mission_contributions        : 기관 → 지사 개선 제안 (Accept → 새 partner_mission 버전)
--   platform_acorn_guidelines    : 플랫폼 레벨 도토리 권고/하드캡 (id=1 싱글톤)
--   org_daily_acorn_caps         : 기관별 일일 도토리 상한 오버라이드
--   partner_stampbook_presets    : 지사 5/10/15칸 스탬프북 프리셋 (순서 있는 미션 배열)
--   view_mission_submission_stats, view_partner_mission_usage_stats : 통계 뷰
-- Phase 0 RLS: 전체 허용(permissive). Phase X 에서 auth.uid() / 기관 클레임 기반으로 조임.
-- NOTE: Phase 1 마이그레이션(20260515000000)이 만든 public.set_updated_at() 트리거 함수를 재사용.
-- NOTE: accepted_version_id 는 partner_missions(id) 를 가리키며, 제안 수용 시 새 버전 row 에 연결.
-- =====================================================


-- ---------------------------------------------------------------
-- 1) mission_contributions (기관 → 지사 개선 제안)
-- ---------------------------------------------------------------
-- 상태 전이:
--   PROPOSED  : 기관이 막 제출. 지사가 검토 대기.
--   ACCEPTED  : 지사 수용 — accepted_version_id 에 새 partner_missions row 연결.
--   REJECTED  : 지사 거절 — review_note 에 피드백.
--   WITHDRAWN : 제안 기관이 스스로 철회.
-- proposed_diff: {title?, description?, config_json?, acorns?} — 변경 항목만 담는 diff 스냅샷.
CREATE TABLE IF NOT EXISTS mission_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_org_mission_id uuid NOT NULL REFERENCES org_missions(id) ON DELETE CASCADE,
  target_partner_mission_id uuid NOT NULL REFERENCES partner_missions(id) ON DELETE CASCADE,
  proposed_diff jsonb NOT NULL DEFAULT '{}'::jsonb,
  proposal_note text,
  proposed_by_org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'PROPOSED'
    CHECK (status IN ('PROPOSED','ACCEPTED','REJECTED','WITHDRAWN')),
  reviewed_by text,
  reviewed_at timestamptz,
  review_note text,
  accepted_version_id uuid REFERENCES partner_missions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 지사(partner)가 받은 제안 목록 + 상태 필터 조회
CREATE INDEX IF NOT EXISTS idx_contributions_target_status
  ON mission_contributions (target_partner_mission_id, status);

-- 특정 기관이 낸 제안 이력 조회
CREATE INDEX IF NOT EXISTS idx_contributions_proposed_by
  ON mission_contributions (proposed_by_org_id);

-- 지사 대시보드 "검토 대기" 배지 — PROPOSED 만 스캔하는 partial index
CREATE INDEX IF NOT EXISTS idx_contributions_proposed_only
  ON mission_contributions (status)
  WHERE status = 'PROPOSED';


-- ---------------------------------------------------------------
-- 2) platform_acorn_guidelines (플랫폼 도토리 가이드라인 싱글톤)
-- ---------------------------------------------------------------
-- id = 1 고정. 항상 단 1행만 존재. 관리자만 수정(추후 RLS 조임).
CREATE TABLE IF NOT EXISTS platform_acorn_guidelines (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  max_daily_suggested int NOT NULL DEFAULT 50,
  max_daily_hard_cap int NOT NULL DEFAULT 200,
  max_per_mission int NOT NULL DEFAULT 20,
  suggested_range_min int NOT NULL DEFAULT 30,
  suggested_range_max int NOT NULL DEFAULT 100,
  notes text,
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 싱글톤 시드 (재실행 안전)
INSERT INTO platform_acorn_guidelines (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;


-- ---------------------------------------------------------------
-- 3) org_daily_acorn_caps (기관별 일일 상한 오버라이드)
-- ---------------------------------------------------------------
-- 미설정이면 platform_acorn_guidelines.max_daily_suggested 를 기본값으로 사용(애플리케이션 로직).
CREATE TABLE IF NOT EXISTS org_daily_acorn_caps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES partner_orgs(id) ON DELETE CASCADE,
  daily_cap int NOT NULL DEFAULT 50 CHECK (daily_cap >= 0),
  updated_by text,
  updated_at timestamptz NOT NULL DEFAULT now()
);


-- ---------------------------------------------------------------
-- 4) partner_stampbook_presets (지사 스탬프북 프리셋 — 5/10/15칸)
-- ---------------------------------------------------------------
-- mission_ids: 순서 있는 UUID 배열 (partner_missions.id 참조 — FK 미설정, 애플리케이션 검증).
-- slot_count 는 1~30 범위. 운영상 5/10/15 를 권장하지만 커스텀 허용.
CREATE TABLE IF NOT EXISTS partner_stampbook_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id uuid NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  slot_count int NOT NULL CHECK (slot_count BETWEEN 1 AND 30),
  mission_ids uuid[] NOT NULL DEFAULT '{}',
  cover_image_url text,
  recommended_for_age text,
  is_published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 지사 대시보드 "공개된 프리셋" 목록
CREATE INDEX IF NOT EXISTS idx_stampbook_presets_partner_published
  ON partner_stampbook_presets (partner_id, is_published);


-- ---------------------------------------------------------------
-- 5) RLS — Phase 0: 전체 허용 (추후 조임)
-- ---------------------------------------------------------------
ALTER TABLE mission_contributions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mission_contributions_all" ON mission_contributions;
CREATE POLICY "mission_contributions_all" ON mission_contributions
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — 제안한 org 또는 대상 partner 스태프만 SELECT/UPDATE

ALTER TABLE platform_acorn_guidelines ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "platform_acorn_guidelines_all" ON platform_acorn_guidelines;
CREATE POLICY "platform_acorn_guidelines_all" ON platform_acorn_guidelines
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — SELECT 는 전체 허용, UPDATE 는 플랫폼 ADMIN 만

ALTER TABLE org_daily_acorn_caps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "org_daily_acorn_caps_all" ON org_daily_acorn_caps;
CREATE POLICY "org_daily_acorn_caps_all" ON org_daily_acorn_caps
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — 해당 org 운영자 또는 상위 지사만 수정

ALTER TABLE partner_stampbook_presets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_stampbook_presets_all" ON partner_stampbook_presets;
CREATE POLICY "partner_stampbook_presets_all" ON partner_stampbook_presets
  FOR ALL USING (true) WITH CHECK (true);
-- TODO: Phase X tighten — 해당 partner 스태프만 INSERT/UPDATE, 공개된 프리셋은 누구나 SELECT


-- ---------------------------------------------------------------
-- 6) updated_at 트리거 (Phase 1 의 public.set_updated_at() 재사용)
-- ---------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_platform_acorn_guidelines_updated_at ON platform_acorn_guidelines;
CREATE TRIGGER trg_platform_acorn_guidelines_updated_at
  BEFORE UPDATE ON platform_acorn_guidelines
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_org_daily_acorn_caps_updated_at ON org_daily_acorn_caps;
CREATE TRIGGER trg_org_daily_acorn_caps_updated_at
  BEFORE UPDATE ON org_daily_acorn_caps
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_partner_stampbook_presets_updated_at ON partner_stampbook_presets;
CREATE TRIGGER trg_partner_stampbook_presets_updated_at
  BEFORE UPDATE ON partner_stampbook_presets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ---------------------------------------------------------------
-- 7) 통계 뷰
-- ---------------------------------------------------------------
-- view_mission_submission_stats: org_mission 단위 제출 집계
--   approved_count : AUTO_APPROVED + APPROVED
--   pending_count  : PENDING_REVIEW
--   rejected_count : REJECTED
--   total_acorns_awarded : 승인된 제출의 awarded_acorns 합계
CREATE OR REPLACE VIEW view_mission_submission_stats AS
SELECT
  om.org_id,
  om.quest_pack_id,
  om.id AS org_mission_id,
  om.kind,
  om.title,
  count(s.*) FILTER (WHERE s.status IN ('AUTO_APPROVED','APPROVED')) AS approved_count,
  count(s.*) FILTER (WHERE s.status = 'PENDING_REVIEW') AS pending_count,
  count(s.*) FILTER (WHERE s.status = 'REJECTED') AS rejected_count,
  count(s.*) AS total_count,
  coalesce(sum(s.awarded_acorns) FILTER (WHERE s.status IN ('AUTO_APPROVED','APPROVED')), 0) AS total_acorns_awarded
FROM org_missions om
LEFT JOIN mission_submissions s ON s.org_mission_id = om.id
GROUP BY om.org_id, om.quest_pack_id, om.id, om.kind, om.title;

-- view_partner_mission_usage_stats: partner_mission 단위 사용 집계
--   copied_count          : 해당 partner_mission 을 복사한 org_missions 개수
--   used_by_org_count     : 복사해간 고유 기관 수
--   total_approved_submissions / total_acorns_awarded : 하위 org_missions 전부 합산
CREATE OR REPLACE VIEW view_partner_mission_usage_stats AS
SELECT
  pm.id AS partner_mission_id,
  pm.partner_id,
  pm.kind,
  pm.title,
  pm.status AS mission_status,
  count(DISTINCT om.id) AS copied_count,
  count(DISTINCT om.org_id) AS used_by_org_count,
  coalesce(sum(stats.approved_count), 0) AS total_approved_submissions,
  coalesce(sum(stats.total_acorns_awarded), 0) AS total_acorns_awarded
FROM partner_missions pm
LEFT JOIN org_missions om ON om.source_mission_id = pm.id
LEFT JOIN view_mission_submission_stats stats ON stats.org_mission_id = om.id
GROUP BY pm.id, pm.partner_id, pm.kind, pm.title, pm.status;

-- =====================================================
-- End of Phase 4 migration.
-- =====================================================
