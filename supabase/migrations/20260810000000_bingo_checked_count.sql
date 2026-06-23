-- 토리 빙고 — grid 별 "동그라미(체크) 개수" 저장.
--   cells_checked = 배치된 칸 중 운영자가 호명한(called) 칸 수 = 화면의 ⭕ 개수.
--   리더보드 순위: 줄 수 → 동그라미 수 → 완료시각 순.

ALTER TABLE org_bingo_grids
  ADD COLUMN IF NOT EXISTS cells_checked int NOT NULL DEFAULT 0;

COMMENT ON COLUMN org_bingo_grids.cells_checked IS
  '배치 ∩ 호명된 칸 수 (화면의 ⭕ 개수). 순위 2차 기준.';

-- 기존 grid 백필 — 현재 호명 상태 기준 ⭕ 개수 계산.
UPDATE org_bingo_grids g
SET cells_checked = COALESCE(sub.cnt, 0)
FROM (
  SELECT gc.grid_id, count(*) AS cnt
  FROM org_bingo_grid_cells gc
  JOIN org_bingo_entries e ON e.id = gc.entry_id
  WHERE e.called_at IS NOT NULL
  GROUP BY gc.grid_id
) sub
WHERE g.id = sub.grid_id;
