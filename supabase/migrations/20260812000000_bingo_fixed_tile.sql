-- 토리 빙고 — 기관 문구 타일 "고정 배치".
--   운영자가 기관 문구 타일을 보드의 특정 칸(fixed_position)에 배치하면,
--   그 칸은 모든 가족 판에서 동일 위치에 자동으로 채워진다(가상 오버레이).
--   fixed_position = null → 미배치(가족이 자유 배치) / 값 → 모든 판 그 칸 고정.

ALTER TABLE org_bingo_entries
  ADD COLUMN IF NOT EXISTS fixed_position int;

COMMENT ON COLUMN org_bingo_entries.fixed_position IS
  '기관 문구 타일의 고정 칸 위치(0-base). null=미배치. 값이면 모든 가족 판 그 칸에 자동 노출/체크.';

-- 같은 보드에서 한 칸엔 고정 타일 하나만.
CREATE UNIQUE INDEX IF NOT EXISTS uq_bingo_entries_fixed_pos
  ON org_bingo_entries (board_id, fixed_position)
  WHERE fixed_position IS NOT NULL;
