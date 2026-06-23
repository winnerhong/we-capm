-- 토리 빙고 — 운영자 "호명(call)" 기능.
--   기관 운영자가 관제실에서 그림을 클릭하면 그 entry 가 호명된다.
--   호명된 그림이 자기 판에 배치돼 있으면 그 칸이 자동 체크되고, 체크된 칸으로만
--   줄(라인)이 완성된다 (정통 빙고). 다시 클릭하면 호명 취소.
--   called_at = null → 아직 호명 안 됨, timestamptz → 호명된 시각.

ALTER TABLE org_bingo_entries
  ADD COLUMN IF NOT EXISTS called_at timestamptz;

COMMENT ON COLUMN org_bingo_entries.called_at IS
  '운영자가 이 그림을 호명한 시각. null=미호명, 값=호명됨(자기 판에 있으면 자동 체크).';

-- 보드별 호명 목록 조회 최적화.
CREATE INDEX IF NOT EXISTS idx_bingo_entries_board_called
  ON org_bingo_entries (board_id)
  WHERE called_at IS NOT NULL;
