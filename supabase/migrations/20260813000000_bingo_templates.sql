-- 토리 빙고 — 문구 타일 템플릿.
--   위너기획(admin)이 전역(GLOBAL) 템플릿을, 기관(org)이 자기 전용(ORG) 템플릿을 만들어
--   보드에 "불러오기"로 문구(+고정 위치)를 일괄 적용한다.
--   scope=GLOBAL → org_id NULL(모든 기관 공용). scope=ORG → org_id 그 기관만.

CREATE TABLE IF NOT EXISTS bingo_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL DEFAULT 'GLOBAL' CHECK (scope IN ('GLOBAL', 'ORG')),
  org_id uuid REFERENCES partner_orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  size int NOT NULL DEFAULT 4 CHECK (size IN (3, 4, 5, 6)),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bingo_templates_scope
  ON bingo_templates (scope);
CREATE INDEX IF NOT EXISTS idx_bingo_templates_org
  ON bingo_templates (org_id) WHERE org_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS bingo_template_tiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES bingo_templates(id) ON DELETE CASCADE,
  keyword text NOT NULL,
  fixed_position int,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bingo_template_tiles_template
  ON bingo_template_tiles (template_id);
-- 템플릿 내 한 칸엔 타일 하나만.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bingo_template_tiles_pos
  ON bingo_template_tiles (template_id, fixed_position)
  WHERE fixed_position IS NOT NULL;

ALTER TABLE bingo_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE bingo_template_tiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "bingo_templates_all" ON bingo_templates FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bingo_template_tiles_all" ON bingo_template_tiles FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
