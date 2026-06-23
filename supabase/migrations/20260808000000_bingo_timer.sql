-- 빙고 배열 타이머.
--   기관 운영자가 [배열 시작] 버튼을 누르면 arrange_ends_at = now() + duration 으로 세팅.
--   참가자는 그때부터 카운트다운 보고 배열 가능. 시간 종료 후 셀 배치/이동/제거 불가.
--   null = 타이머 미세팅 (자유 배열 또는 시작 전).

ALTER TABLE org_bingo_boards
  ADD COLUMN IF NOT EXISTS arrange_ends_at timestamptz;

COMMENT ON COLUMN org_bingo_boards.arrange_ends_at IS
  '빙고판 배열 마감 시각. null=미세팅, 미래시각=진행중, 과거시각=종료(잠금).';
