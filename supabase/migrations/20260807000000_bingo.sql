-- 토리 빙고 — 가족 사진+키워드를 모아 본인 빙고판을 채우는 협업형 게임.
--
-- 데이터 모델 4종:
--   org_bingo_boards       : 보드 정의 (크기·승리 줄·주제·상태). 기관 단위.
--   org_bingo_entries      : 가족별 1팀 1개 (사진+키워드) — 피드 source.
--   org_bingo_grids        : 가족별 본인 빙고판 + 라인 카운트 캐시.
--   org_bingo_grid_cells   : 각 칸에 배치된 entry. (grid_id, position) PK.
--   org_bingo_rankings     : 운영자가 손으로 매긴 순위 (자동 순위 위에 우선).
--
-- RLS: Phase 0 permissive — 다른 게임 테이블과 동일 정책 (인증된 클라이언트는 전체 access).
--      추후 Phase 1 에서 user_id = auth.uid() 등으로 좁힐 예정.

CREATE TABLE IF NOT EXISTS org_bingo_boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES partner_orgs(id) ON DELETE CASCADE,
  event_id uuid REFERENCES org_events(id) ON DELETE SET NULL,
  name text NOT NULL,
  size int NOT NULL CHECK (size IN (3, 4, 5, 6)),
  lines_to_win int NOT NULL DEFAULT 1 CHECK (lines_to_win BETWEEN 1 AND 3),
  keyword_theme text,
  status text NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT', 'LIVE', 'ENDED')),
  show_ranking boolean NOT NULL DEFAULT true,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bingo_boards_org_status
  ON org_bingo_boards(org_id, status);
CREATE INDEX IF NOT EXISTS idx_bingo_boards_event
  ON org_bingo_boards(event_id) WHERE event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS org_bingo_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES org_bingo_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  photo_url text NOT NULL,
  keyword text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bingo_entries_board
  ON org_bingo_entries(board_id, created_at DESC);

CREATE TABLE IF NOT EXISTS org_bingo_grids (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id uuid NOT NULL REFERENCES org_bingo_boards(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  lines_completed int NOT NULL DEFAULT 0,
  cells_filled int NOT NULL DEFAULT 0,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(board_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_bingo_grids_board_lines
  ON org_bingo_grids(board_id, lines_completed DESC, finished_at ASC);

CREATE TABLE IF NOT EXISTS org_bingo_grid_cells (
  grid_id uuid NOT NULL REFERENCES org_bingo_grids(id) ON DELETE CASCADE,
  position int NOT NULL,
  entry_id uuid NOT NULL REFERENCES org_bingo_entries(id) ON DELETE CASCADE,
  placed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (grid_id, position),
  UNIQUE(grid_id, entry_id)
);
CREATE INDEX IF NOT EXISTS idx_bingo_cells_grid
  ON org_bingo_grid_cells(grid_id);

CREATE TABLE IF NOT EXISTS org_bingo_rankings (
  board_id uuid NOT NULL REFERENCES org_bingo_boards(id) ON DELETE CASCADE,
  rank int NOT NULL CHECK (rank > 0),
  user_id uuid NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  prize text,
  set_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (board_id, rank)
);

ALTER TABLE org_bingo_boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_bingo_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_bingo_grids ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_bingo_grid_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_bingo_rankings ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "bingo_boards_all" ON org_bingo_boards FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bingo_entries_all" ON org_bingo_entries FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bingo_grids_all" ON org_bingo_grids FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bingo_cells_all" ON org_bingo_grid_cells FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "bingo_rankings_all" ON org_bingo_rankings FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
